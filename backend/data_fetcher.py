"""
Data Fetcher — Phase 1 (Multi-table)
Intent별 복수 Gold 테이블을 조회하여 풍부한 section 데이터 제공.
규칙: 전체 보강 조회 총 3초 이내, 개별 쿼리 실패 시 skip.
"""
import logging
import time
from backend.db_client import DBClient

logger = logging.getLogger("data_fetcher")

SCHEMA = "dev.ai_pb_gold"

# ============================================================
# Intent별 조회 테이블 정의 (Phase 1: portfolio_diagnosis + risk_alert)
# ============================================================

INTENT_QUERIES = {
    "portfolio_diagnosis": [
        {
            "key": "diagnosis",
            "sql": f"SELECT * FROM {SCHEMA}.gd_serving_portfolio_diagnosis WHERE customer_id = '{{cid}}' LIMIT 1",
        },
        {
            "key": "signals",
            "sql": f"SELECT asset_name, signal_name, signal_category, signal_interpretation, risk_notice_required FROM {SCHEMA}.gd_customer_portfolio_signal WHERE customer_id = '{{cid}}' LIMIT 10",
        },
        {
            "key": "insight_cards",
            "sql": f"SELECT title, summary, impact_level, published_at, action_recommendation FROM {SCHEMA}.gd_pb_insight_card WHERE customer_id = '{{cid}}' ORDER BY published_at DESC LIMIT 5",
        },
        {
            "key": "rebalancing",
            "sql": f"SELECT rebalance_needed, rebalance_urgency, rebalance_action_summary, overweight_assets, loss_cut_candidates FROM {SCHEMA}.gd_serving_rebalancing_action WHERE customer_id = '{{cid}}' LIMIT 1",
        },
    ],
    "risk_alert": [
        {
            "key": "signals",
            "sql": f"SELECT asset_name, signal_name, signal_category, signal_interpretation, risk_notice_required, valuation_amount, holding_weight FROM {SCHEMA}.gd_customer_portfolio_signal WHERE customer_id = '{{cid}}' LIMIT 15",
        },
        {
            "key": "insight_cards",
            "sql": f"SELECT title, summary, impact_level, published_at, action_recommendation FROM {SCHEMA}.gd_pb_insight_card WHERE customer_id = '{{cid}}' ORDER BY published_at DESC LIMIT 5",
        },
    ],
    "holding_risk_check": [
        {
            "key": "signals",
            "sql": f"SELECT asset_name, signal_name, signal_category, signal_interpretation, risk_notice_required FROM {SCHEMA}.gd_customer_portfolio_signal WHERE customer_id = '{{cid}}' AND risk_notice_required = true LIMIT 10",
        },
    ],
    "rebalancing_recommendation": [
        {
            "key": "rebalancing",
            "sql": f"SELECT * FROM {SCHEMA}.gd_serving_rebalancing_action WHERE customer_id = '{{cid}}' LIMIT 1",
        },
    ],
}


def fetch_supplemental(intent: str, customer_id: str, db: DBClient) -> dict | None:
    """
    Intent에 필요한 보강 데이터를 Gold 테이블에서 복수 조회 (순차).
    
    Returns:
        dict: { "diagnosis": [...rows], "signals": [...rows], ... }
        각 key는 조회 결과 (list of dict). 실패 시 해당 key 없음.
    """
    queries = INTENT_QUERIES.get(intent)
    if not queries:
        return None

    start = time.time()
    results = {}

    for q in queries:
        key = q["key"]
        sql = q["sql"].replace("{cid}", customer_id)

        try:
            elapsed_so_far = time.time() - start
            if elapsed_so_far > 3.0:
                logger.warning(f"[DATA_FETCH] Total timeout reached ({elapsed_so_far:.2f}s), skipping {key}")
                break

            rows = db._execute(sql)
            results[key] = rows
            logger.info(f"[DATA_FETCH] {key}: {len(rows)} rows")

        except Exception as e:
            logger.warning(f"[DATA_FETCH] {key} failed: {e}")
            continue  # 개별 실패는 skip

    elapsed = time.time() - start
    logger.info(f"[DATA_FETCH] Total: {len(results)} sources in {elapsed:.2f}s")

    return results if results else None


# ============================================================
# 병렬 조회 (V2용) — Intent 결정 전에 전체 테이블 동시 조회
# ============================================================

# 전체 데이터 소스 (intent 무관하게 모두 조회)
ALL_SOURCES = [
    {"key": "diagnosis", "sql": f"SELECT * FROM {SCHEMA}.gd_serving_portfolio_diagnosis WHERE customer_id = '{{cid}}' LIMIT 1"},
    {"key": "signals", "sql": f"SELECT asset_name, signal_name, signal_category, signal_interpretation, risk_notice_required, valuation_amount, holding_weight, valuation_return_rate FROM {SCHEMA}.gd_customer_portfolio_signal WHERE customer_id = '{{cid}}' LIMIT 15"},
    {"key": "insight_cards", "sql": f"SELECT title, summary, impact_level, published_at, action_recommendation FROM {SCHEMA}.gd_pb_insight_card WHERE customer_id = '{{cid}}' ORDER BY published_at DESC LIMIT 5"},
    {"key": "rebalancing", "sql": f"SELECT rebalance_needed, rebalance_urgency, rebalance_action_summary, overweight_assets, loss_cut_candidates FROM {SCHEMA}.gd_serving_rebalancing_action WHERE customer_id = '{{cid}}' LIMIT 1"},
    {"key": "events", "sql": f"SELECT event_id, event_title, event_type, event_subtype, related_sector, related_theme, ai_investment_view, sentiment_score, importance_score, TO_JSON(tags) AS tags_json, published_at, event_summary, impacted_asset_count, impacted_assets AS impacted_assets_json FROM {SCHEMA}.gd_llm_event_context WHERE event_type = '뉴스' ORDER BY published_at DESC LIMIT 5"},
    {"key": "market_overview", "sql": f"SELECT * FROM {SCHEMA}.app_cache_market_overview ORDER BY asset_count DESC LIMIT 10"},
    {"key": "holdings", "sql": f"SELECT * FROM {SCHEMA}.app_cache_holding_signals WHERE customer_id = '{{cid}}' ORDER BY date DESC, rn ASC LIMIT 10"},
    # Phase 2: 신규 카드 테이블 (실제 존재하는 테이블/컬럼으로 수정)
    {"key": "market_events", "sql": f"SELECT event_id, event_title, event_type, event_subtype, related_sector, related_theme, ai_investment_view, sentiment_score, importance_score, published_at, event_summary, impacted_assets AS impacted_assets_json FROM {SCHEMA}.gd_llm_event_context WHERE event_type = '뉴스' ORDER BY published_at DESC LIMIT 8"},
        {"key": "schedule_events", "sql": f"SELECT event_id, event_title, event_type AS d_tag, scheduled_date AS event_date, event_summary AS description, CAST(NULL AS STRING) AS key_points_json, CAST(NULL AS STRING) AS past_cases_json, CAST(NULL AS STRING) AS related_assets_json FROM {SCHEMA}.app_cache_news_feed WHERE event_type IN ('주총', '배당', 'ELS상환', '매크로지표') AND scheduled_date IS NOT NULL AND scheduled_date > CURRENT_DATE() ORDER BY scheduled_date ASC LIMIT 15"},
    {"key": "top_investors", "sql": f"SELECT customer_id AS investor_id, investor_type, latest_trade_date AS signal_date, daily_buys_json AS daily_buy_tickers, daily_sells_json AS daily_sell_tickers, sector_allocation_json, domestic_top_json, overseas_top_json, total_asset_krw, holding_count AS avg_holdings, investor_emoji, short_status, tags_json, total_return_pct FROM {SCHEMA}.app_top_investor_cache ORDER BY rank ASC LIMIT 3"},
    {"key": "news_feed", "sql": f"SELECT news_id, event_id, news_title AS title, event_title, event_subtype AS badge, ai_investment_view AS description, news_summary, event_summary, TO_JSON(tags) AS hashtags_json, related_sector, related_theme, sentiment_score, importance_score, published_at, impacted_assets AS related_assets_json FROM {SCHEMA}.gd_llm_event_context WHERE event_type = '\ub274\uc2a4' ORDER BY published_at DESC LIMIT 8"},
]


def fetch_all_parallel(customer_id: str, db: DBClient) -> dict:
    """
    모든 데이터 소스를 병렬로 조회. Intent 결정 전에 호출.
    ThreadPoolExecutor로 4개 쿼리 동시 실행 → 최대 소요시간 = 가장 느린 1개 쿼리.
    
    Returns:
        dict: { "diagnosis": [...], "signals": [...], "insight_cards": [...], "rebalancing": [...] }
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    start = time.time()
    results = {}

    def _run_query(key: str, sql: str):
        try:
            rows = db._execute(sql)
            return key, rows
        except Exception as e:
            logger.warning(f"[DATA_FETCH_PARALLEL] {key} failed: {e}")
            return key, None

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = []
        for src in ALL_SOURCES:
            sql = src["sql"].replace("{cid}", customer_id)
            futures.append(executor.submit(_run_query, src["key"], sql))

        for future in as_completed(futures):
            key, rows = future.result()
            if rows is not None:
                results[key] = rows

    elapsed = time.time() - start
    logger.info(f"[DATA_FETCH_PARALLEL] {len(results)} sources in {elapsed:.2f}s")
    return results


# ============================================================
# Card Data Builders (Phase 2)
# ============================================================

def build_investment_change_summary(data: dict, question: str = "") -> dict:
    """app_cache_holding_signals → InvestmentChangeSummaryData"""
    holdings = data.get("holdings", [])
    items = []
    for h in holdings[:5]:
        items.append({
            "asset_name": h.get("asset_name", ""),
            "tag": h.get("signal_tag") or h.get("tag") or "변동",
            "desc": h.get("signal_summary") or h.get("summary") or "",
            "sub_desc": h.get("sub_summary"),
            "time": h.get("signal_time") or h.get("time"),
        })
    return {
        "ai_summary": f"보유 종목 {len(items)}개의 최근 변동 현황이에요.",
        "items": items,
    }


def build_investment_change_detail(data: dict, asset_name: str = "") -> dict:
    """app_cache_holding_signals + gd_customer_portfolio_signal → HoldingDetailContentProps"""
    holdings = data.get("holdings", [])
    signals = data.get("signals", [])

    # asset_name으로 필터링
    target = next((h for h in holdings if asset_name and asset_name in h.get("asset_name", "")), holdings[0] if holdings else {})
    sig = next((s for s in signals if asset_name and asset_name in s.get("asset_name", "")), {})

    return {
        "tag": target.get("tag") or sig.get("signal_category") or "분석",
        "title": target.get("asset_name") or asset_name or "종목",
        "summary": target.get("summary") or sig.get("signal_interpretation") or "",
        "summarySub": target.get("sub_summary") or "",
        "reasons": target.get("reasons_json") if isinstance(target.get("reasons_json"), list) else [],
        "chart": target.get("chart_data"),
        "history": target.get("history_json") if isinstance(target.get("history_json"), list) else [],
        "masters": target.get("masters_json") if isinstance(target.get("masters_json"), list) else [],
        "buyCount": int(target.get("buy_count") or 0),
        "sellCount": int(target.get("sell_count") or 0),
        "aiPbSummary": target.get("ai_pb_summary") or sig.get("signal_interpretation"),
    }


def build_market_event_summary(data: dict, question: str = "") -> dict:
    """app_cache_market_events → MarketEventSummaryData"""
    events = data.get("market_events") or data.get("events", [])
    items = []
    for e in events[:5]:
        items.append({
            "event_id": str(e.get("event_id", "")),
            "title": e.get("event_title", ""),
            "time": e.get("sort_timestamp", "")[:10] if e.get("sort_timestamp") else None,
            "desc": e.get("ai_investment_view", ""),
            "hashtags": [],
            "relevance": e.get("related_sector"),
        })
    return {
        "ai_summary": "현재 시장에서 주목해야 할 이벤트예요.",
        "items": items,
    }


def build_market_event_detail(data: dict, event_title: str = "") -> dict:
    """app_cache_market_events → EventDetailContentProps (data=raw event row)"""
    events = data.get("market_events") or data.get("events", [])
    target = next((e for e in events if event_title and event_title in e.get("event_title", "")), events[0] if events else {})
    return target  # EventDetailContent expects raw data with impacted_assets_json, enriched_sections etc.


def build_upcoming_schedule_summary(data: dict, question: str = "") -> dict:
    """app_cache_schedule_events → UpcomingScheduleSummaryData"""
    from datetime import date as _date, datetime as _dt
    import re as _re
    schedules = data.get("schedule_events", [])
    today = _date.today()
    _WEEKDAY_KR = ["월", "화", "수", "목", "금", "토", "일"]

    def _d_tag(event_date) -> str:
        """scheduled_date → 'D-9' 형식"""
        try:
            if isinstance(event_date, str):
                d = _dt.strptime(event_date[:10], "%Y-%m-%d").date()
            else:
                d = event_date
            diff = (d - today).days
            if diff > 0:   return f"D-{diff}"
            if diff == 0:  return "D-Day"
            return f"D+{abs(diff)}"
        except Exception:
            return "D-?"

    def _fmt_date(event_date) -> str:
        """scheduled_date → '06.18 (목)' 형식"""
        try:
            if isinstance(event_date, str):
                d = _dt.strptime(event_date[:10], "%Y-%m-%d").date()
            else:
                d = event_date
            wd = _WEEKDAY_KR[d.weekday()]
            return f"{d.month:02d}.{d.day:02d}. ({wd})"
        except Exception:
            return str(event_date)[:10] if event_date else ""

    items = []
    for s in schedules[:8]:
        event_date = s.get("event_date")
        items.append({
            "event_id": str(s.get("event_id", "")),
            "title": s.get("event_title", ""),
            "d_tag": _d_tag(event_date),
            "date": _fmt_date(event_date),
            "desc": s.get("description", ""),
        })

    # 중요 이벤트 강조 (매크로지표 우선)
    macro = [it for it in items if any(kw in it["title"] for kw in ["FOMC","금리","CPI","GDP","연준"])]
    others = [it for it in items if it not in macro]
    sorted_items = (macro + others)[:5]

    return {
        "ai_summary": f"{len(items)}개의 주요 일정을 확인하세요.",
        "items": sorted_items,
    }


def build_upcoming_schedule_detail(data: dict, event_title: str = "") -> dict:
    """app_cache_schedule_events → UpcomingScheduleDetailContentProps"""
    import json
    schedules = data.get("schedule_events", [])
    # DB 이벤트명이 사용자 질문에 포함되는지 체크 (어떤 일정이든 자동 매칭)
    q_lower = event_title.lower()
    target = next(
        (s for s in schedules if s.get("event_title", "").lower() and s.get("event_title", "").lower() in q_lower),
        None
    )
    if not target:
        # 단어 레벨 부분 매칭 (공백 구분 키워드 중 2글자 이상)
        q_words = [w for w in q_lower.split() if len(w) >= 2]
        best, best_score = None, 0
        for s in schedules:
            title_lower = s.get("event_title", "").lower()
            score = sum(1 for w in q_words if w in title_lower)
            if score > best_score:
                best, best_score = s, score
        target = best if best and best_score > 0 else (schedules[0] if schedules else {})
    key_points = target.get("key_points_json")
    past_cases = target.get("past_cases_json")
    related_assets = target.get("related_assets_json")
    return {
        "title": target.get("event_title", ""),
        "d_tag": target.get("d_tag", ""),
        "date": target.get("event_date", ""),
        "summary": target.get("description", ""),
        "key_points": json.loads(key_points) if isinstance(key_points, str) else (key_points or []),
        "past_cases": json.loads(past_cases) if isinstance(past_cases, str) else (past_cases or []),
        "related_assets": json.loads(related_assets) if isinstance(related_assets, str) else (related_assets or []),
    }


def build_expert_movement_detail(data: dict, filter_type: str = "") -> dict:
    """app_cache_top_investors → MasterInsightContentProps"""
    investors = data.get("top_investors", [])
    return {
        "investors": investors,
        "filter_type": filter_type or None,
    }


def build_news_signal_summary(data: dict, question: str = "") -> dict:
    """app_cache_news_feed → NewsSignalSummaryData"""
    news = data.get("news_feed") or data.get("events", [])
    items = []
    for n in news[:5]:
        items.append({
            "news_id": str(n.get("news_id") or n.get("event_id", "")),
            "title": n.get("title") or n.get("event_title", ""),
            "badge": n.get("badge") or n.get("event_subtype"),
            "desc": n.get("description") or n.get("ai_investment_view"),
        })
    return {
        "ai_summary": "투자에 영향을 줄 수 있는 뉴스를 선별했어요.",
        "news_items": items,
    }


def build_news_signal_detail(data: dict, news_title: str = "") -> dict:
    """gd_llm_event_context(뉴스) → NewsSignalDetailContentProps"""
    import json
    news = data.get("news_feed") or data.get("events", [])
    # 제목 매칭 (title 또는 event_title)
    target = next(
        (n for n in news if news_title and (
            news_title in (n.get("title") or "") or
            news_title in (n.get("event_title") or "")
        )),
        news[0] if news else {}
    )
    # hashtags: tags JSON 배열
    hashtags_raw = target.get("hashtags_json")
    try:
        hashtags = json.loads(hashtags_raw) if isinstance(hashtags_raw, str) else (hashtags_raw or [])
    except:
        hashtags = []

    # related_assets: impacted_assets 파싱
    related_raw = target.get("related_assets_json")
    try:
        related = json.loads(related_raw) if isinstance(related_raw, str) else (related_raw or [])
        if isinstance(related, list):
            related = [{"asset_name": r.get("asset_name", ""), "asset_type": r.get("asset_type", ""),
                        "reason": r.get("short_reason") or r.get("reason", "")} for r in related[:5]]
    except:
        related = []

    # why_notable: event_summary → 문장 분리
    summary = target.get("event_summary") or target.get("news_summary") or target.get("description") or ""
    why_notable = [s.strip() for s in summary.split(". ") if len(s.strip()) > 5][:3]

    # sector_impacts: related_sector 기반
    sector = target.get("related_sector") or target.get("related_theme") or ""
    sentiment = float(target.get("sentiment_score") or 0)
    sector_impacts = [{"sector": sector, "direction": "positive" if sentiment >= 0 else "negative",
                       "impact_pct": round(abs(sentiment) * 10, 1)}] if sector else []

    return {
        "title": target.get("title") or target.get("event_title", ""),
        "badge": target.get("badge") or target.get("event_subtype"),
        "why_notable": why_notable,
        "sector_impacts": sector_impacts,
        "hashtags": hashtags if isinstance(hashtags, list) else [],
        "related_assets": related,
        "ai_view": target.get("description") or target.get("ai_investment_view") or "",
    }
