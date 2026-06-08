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
    {"key": "events", "sql": f"SELECT event_id, event_title, event_type, event_subtype, related_sector, related_theme, ai_investment_view, sentiment_score, impacted_asset_count, impacted_assets_json, published_at, importance_score, enriched_sections, tags_json FROM {SCHEMA}.app_cache_news_feed ORDER BY sort_timestamp DESC LIMIT 5"},
    {"key": "market_overview", "sql": f"SELECT * FROM {SCHEMA}.app_cache_market_overview ORDER BY asset_count DESC LIMIT 10"},
    {"key": "holdings", "sql": f"SELECT * FROM {SCHEMA}.app_cache_holding_signals WHERE customer_id = '{{cid}}' ORDER BY date DESC, rn ASC LIMIT 10"},
    # Phase 2: 신규 카드 테이블
    {"key": "market_events", "sql": f"SELECT event_id, event_title, event_type, event_subtype, related_sector, ai_investment_view, sentiment_score, impacted_assets_json, enriched_sections, tags_json, sort_timestamp FROM {SCHEMA}.app_cache_market_events ORDER BY sort_timestamp DESC LIMIT 8"},
    {"key": "schedule_events", "sql": f"SELECT event_id, event_title, d_tag, event_date, description, key_points_json, past_cases_json, related_assets_json FROM {SCHEMA}.app_cache_schedule_events ORDER BY event_date ASC LIMIT 8"},
    {"key": "top_investors", "sql": f"SELECT investor_id, investor_type, signal_date, daily_buy_tickers, daily_sell_tickers, sector_allocation_json, domestic_top_json, overseas_top_json, total_asset_krw, avg_holdings FROM {SCHEMA}.app_cache_top_investors ORDER BY signal_date DESC LIMIT 3"},
    {"key": "news_feed", "sql": f"SELECT news_id, title, badge, description, why_notable_json, sector_impacts_json, hashtags_json, related_assets_json, relevance_score FROM {SCHEMA}.app_cache_news_feed ORDER BY sort_timestamp DESC LIMIT 8"},
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
    schedules = data.get("schedule_events", [])
    items = []
    for s in schedules[:5]:
        items.append({
            "event_id": str(s.get("event_id", "")),
            "title": s.get("event_title", ""),
            "d_tag": s.get("d_tag", "D+?"),
            "date": s.get("event_date", ""),
            "desc": s.get("description", ""),
        })
    return {
        "ai_summary": f"{len(items)}개의 주요 일정을 확인하세요.",
        "items": items,
    }


def build_upcoming_schedule_detail(data: dict, event_title: str = "") -> dict:
    """app_cache_schedule_events → UpcomingScheduleDetailContentProps"""
    import json
    schedules = data.get("schedule_events", [])
    target = next((s for s in schedules if event_title and event_title in s.get("event_title", "")), schedules[0] if schedules else {})
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
    """app_cache_news_feed → NewsSignalDetailContentProps"""
    import json
    news = data.get("news_feed") or data.get("events", [])
    target = next((n for n in news if news_title and news_title in (n.get("title") or n.get("event_title", ""))), news[0] if news else {})
    why = target.get("why_notable_json")
    sectors = target.get("sector_impacts_json")
    hashtags = target.get("hashtags_json")
    related = target.get("related_assets_json")
    return {
        "title": target.get("title") or target.get("event_title", ""),
        "why_notable": json.loads(why) if isinstance(why, str) else (why or []),
        "sector_impacts": json.loads(sectors) if isinstance(sectors, str) else (sectors or []),
        "hashtags": json.loads(hashtags) if isinstance(hashtags, str) else (hashtags or []),
        "related_assets": json.loads(related) if isinstance(related, str) else (related or []),
    }
