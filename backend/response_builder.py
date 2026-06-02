"""
Response Builder — Phase 1
Genie 결과 + 보강 데이터를 표준 JSON 구조로 조립.
Section types: metrics_table, alert_list, action_list, text_insight
"""
import logging
import time
from datetime import date

from backend.intent_classifier import classify
from backend.data_fetcher import fetch_supplemental
from backend.db_client import DBClient

logger = logging.getLogger("response_builder")

# 전체 구조화 overhead 제한 (2초)
MAX_OVERHEAD_SEC = 2.0
# Intent confidence 최소 기준
MIN_CONFIDENCE = 0.4


def build_structured_response(
    genie_result: dict,
    customer_id: str,
    customer_name: str | None,
    segment: str | None,
    db: DBClient,
    question: str = "",
) -> dict | None:
    """
    Genie 응답을 받아 구조화 JSON을 생성.
    
    Returns:
        구조화 JSON dict, 또는 None (fallback 신호).
    """
    start = time.time()

    try:
        # 1. Intent 분류
        intent_result = classify(
            question=question,
            sql=genie_result.get("sql"),
            answer=genie_result.get("answer"),
        )

        if intent_result["confidence"] < MIN_CONFIDENCE:
            return None  # fallback

        intent = intent_result["intent"]
        if intent == "fallback":
            return None

        # 2. Genie table_data에서 sections 생성
        sections = _build_sections_from_genie(intent, genie_result.get("table_data"))

        # 3. 보강 데이터 조회 (timeout 내에서)
        elapsed = time.time() - start
        remaining = MAX_OVERHEAD_SEC - elapsed
        if remaining > 0.3:  # 최소 0.3초 여유가 있을 때만 조회
            extra = fetch_supplemental(intent, customer_id, db)
            if extra:
                extra_sections = _build_sections_from_cache(intent, extra)
                sections.extend(extra_sections)

        # 4. 빈 sections 이면 fallback
        if not sections:
            return None

        # 5. JSON 조립
        structured = {
            "intent": intent,
            "intent_confidence": intent_result["confidence"],
            "customer_context": {
                "customer_id": customer_id,
                "customer_name": customer_name or customer_id,
                "segment_code": segment,
            },
            "answer_meta": {
                "as_of_date": str(date.today()),
                "data_quality": "sufficient" if len(sections) >= 3 else "partial",
            },
            "headline": _build_headline(intent, customer_name, segment),
            "summary": genie_result.get("answer", ""),  # Genie 원문 그대로
            "overall_status": _infer_status(intent, sections),
            "sections": sections,
            "recommended_actions": _extract_actions(sections),
            "disclaimer": _get_disclaimer(segment),
        }

        elapsed = time.time() - start
        logger.info(f"[BUILDER] Structured response built in {elapsed:.2f}s, {len(sections)} sections")
        return structured

    except Exception as e:
        logger.error(f"[BUILDER] Failed, falling back: {e}")
        return None  # Silent fail → fallback


# ============================================================
# 영문 컨럼명 → 한글 표시명 매핑
# ============================================================

COLUMN_DISPLAY_NAMES = {
    "customer_name": "고객명",
    "customer_id": "고객 ID",
    "age_group": "연령대",
    "investment_level": "투자 레벨",
    "risk_profile": "위험 성향",
    "investor_risk_profile": "투자자 위험 성향",
    "investment_style": "투자 스타일",
    "investment_goal": "투자 목표",
    "portfolio_risk_level": "포트폴리오 위험등급",
    "diversification_score": "분산 점수",
    "concentration_level": "집중도",
    "total_holding_count": "보유 종목 수",
    "domestic_stock_ratio": "국내주식 비율",
    "foreign_stock_ratio": "해외주식 비율",
    "etf_ratio": "ETF 비율",
    "fund_ratio": "펀드 비율",
    "bond_ratio": "채권 비율",
    "derivative_ratio": "파생상품 비율",
    "top1_asset_weight": "1위 종목 비중",
    "top3_asset_weight": "상위 3종목 비중",
    "top_concentrated_sector": "최대 집중 섹터",
    "top_sector_weight": "최대 섹터 비중",
    "avg_return": "평균 수익률",
    "total_profit": "총 수익",
    "total_loss": "총 손실",
    "loss_asset_count": "손실 종목 수",
    "concentration_alert": "집중도 경고",
    "rebalance_frequency": "리밸런싱 빈도",
    "portfolio_theme": "포트폴리오 테마",
    "valuation_amount": "평가금액",
    "valuation_return_rate": "수익률",
    "holding_weight": "비중",
    "asset_name": "종목명",
    "signal_name": "신호명",
    "signal_code": "신호 코드",
    "signal_category": "신호 유형",
    "interpretation": "해석",
    "signal_interpretation": "신호 해석",
    "holding_quantity": "보유 수량",
    "average_buy_price": "평균 매수가",
    "valuation_profit_loss_amount": "평가 손익",
    "holding_period_days": "보유 기간(일)",
    "sector": "섹터",
    "market": "시장",
    "current_price": "현재가",
    "rsi": "RSI",
    "rsi_signal": "RSI 신호",
    "volatility": "변동성",
    "mdd": "MDD",
    "beta": "베타",
    "sharpe_ratio": "샤프비율",
    "per": "PER",
    "pbr": "PBR",
    "macd": "MACD",
    "news_sentiment": "뉴스 센티먼트",
    "signal_date": "신호 일자",
    "indicator_value_num": "지표 값",
    "risk_notice_required": "위험 경고 필요",
    "rebalance_needed": "리밸런싱 필요",
    "rebalance_urgency": "긴급도",
    "overweight_assets": "과대 비중 종목",
    "loss_cut_candidates": "손절 후보",
    "underweight_suggestion": "비중 확대 제안",
    "rebalance_action_summary": "리밸런싱 요약",
    "target_stock_ratio": "목표 주식 비율",
    "target_bond_ratio": "목표 채권 비율",
    "market_segment": "시장 구분",
    "briefing_text": "브리핑",
    "market_regime": "시장 국면",
    "market_sentiment": "시장 심리",
    "top_gainer_asset": "상승 1위",
    "top_loser_asset": "하락 1위",
    "total_event_count": "이벤트 수",
    "avg_impact_score": "평균 영향도",
    "latest_event_title": "최신 이벤트",
    "action_recommendation": "액션 제안",
    "customer_risk_profile": "고객 위험 성향",
    "high_impact_event_cards": "고영향 이벤트",
    "top_action_recommendation": "최우선 액션",
    "card_type": "카드 유형",
    "impact_level": "영향도",
    "title": "제목",
    "summary": "요약",
    "published_at": "발행일",
    "segment_2x2_code": "세그먼트 코드",
    "segment_name": "세그먼트명",
    # 추가 매핑 (수익률/지표 관련)
    "total_return_rate": "총 수익률",
    "avg_return_rate": "평균 수익률",
    "max_return_rate": "최대 수익률",
    "min_return_rate": "최소 수익률",
    "total_valuation_amount": "총 평가금액",
    "total_investment_amount": "총 투자금액",
    "total_profit_loss": "총 손익",
    "profit_asset_count": "수익 종목 수",
    "risk_signal_count": "리스크 신호 수",
    "segment_label": "세그먼트",
    "investor_type": "투자자 유형",
    "account_type": "계좌 유형",
    "join_date": "가입일",
    "last_trade_date": "최근 거래일",
    "preferred_sector": "선호 섹터",
    "trading_frequency": "거래 빈도",
}

# 표시하지 않을 컨럼 (customer_id 등 내부용)
HIDDEN_COLUMNS = {"customer_id", "account_id", "holding_id", "asset_id", "scenario_id", "investor_profile_id"}


# ============================================================
# Genie table_data → Sections
# ============================================================

def _build_sections_from_genie(intent: str, table_data: dict | None) -> list:
    """Genie가 반환한 table_data를 sections으로 변환."""
    if not table_data:
        return []

    columns = table_data.get("columns", [])
    rows = table_data.get("rows", [])
    if not columns or not rows:
        return []

    # 내부용 컨럼 제외 + 한글 매핑
    visible_indices = [i for i, c in enumerate(columns) if c.lower() not in HIDDEN_COLUMNS]
    display_headers = [COLUMN_DISPLAY_NAMES.get(columns[i], columns[i]) for i in visible_indices]

    # metrics_table section으로 변환 (행 수 제한: 최대 10행)
    display_rows = []
    for row in rows[:10]:
        display_rows.append([_format_value(row[i]) for i in visible_indices])

    section = {
        "section_type": "metrics_table",
        "title": "주요 지표" if intent == "portfolio_diagnosis" else "데이터 요약",
        "icon": "📊",
        "content": {
            "headers": display_headers,
            "rows": display_rows,
        }
    }
    return [section]


# ============================================================
# app_cache 데이터 → Sections
# ============================================================

def _build_sections_from_cache(intent: str, extra: dict) -> list:
    """app_cache 조회 결과를 intent별 sections으로 변환."""
    table = extra.get("table", "")
    rows = extra.get("rows", [])
    if not rows:
        return []

    sections = []

    if table == "app_cache_portfolio_summary" and rows:
        row = rows[0]
        # 포트폴리오 요약 지표를 text_insight로
        summary_parts = []
        if row.get("portfolio_risk_level"):
            summary_parts.append(f"포트폴리오 위험등급: {row['portfolio_risk_level']}")
        if row.get("total_holding_count"):
            summary_parts.append(f"보유 종목 수: {row['total_holding_count']}개")
        if row.get("concentration_level"):
            summary_parts.append(f"집중도: {row['concentration_level']}")
        if row.get("diversification_score"):
            summary_parts.append(f"분산 점수: {row['diversification_score']}")

        if summary_parts:
            sections.append({
                "section_type": "text_insight",
                "title": "포트폴리오 상태",
                "icon": "🧨",
                "content": {
                    "text": " / ".join(summary_parts),
                    "highlights": [],
                }
            })

    elif table == "app_cache_holding_signals" and rows:
        # 신호 목록을 alert_list로
        items = []
        for r in rows[:5]:
            level = "warning" if r.get("signal_category") == "리스크" else "caution"
            items.append({
                "level": level,
                "title": f"{r.get('asset_name', '')} - {r.get('signal_name', '')}",
                "detail": r.get("interpretation", ""),
                "date": r.get("date", ""),
            })
        if items:
            sections.append({
                "section_type": "alert_list",
                "title": "보유종목 신호",
                "icon": "⚠️",
                "content": {"items": items}
            })

    return sections


# ============================================================
# 보조 함수
# ============================================================

def _format_value(v) -> str:
    """None, 숫자 등을 표시 가능한 문자열로 변환."""
    if v is None:
        return "-"
    if isinstance(v, float):
        if abs(v) >= 1_000_000:
            return f"{v/100_000_000:.1f}억원"
        if abs(v) < 1:
            return f"{v*100:.1f}%"
        return f"{v:,.0f}"
    return str(v)


def _build_headline(intent: str, customer_name: str | None, segment: str | None) -> str:
    """intent + 세그먼트별 headline 생성."""
    name = customer_name or ""
    titles = {
        "portfolio_diagnosis": "포트폴리오 종합 진단",
        "risk_alert": "위험 신호 점검",
    }
    base = titles.get(intent, "AI PB 분석")

    if segment == "SEG01":
        return f"{name}님, {base} 결과를 정리해드릴게요 📊"
    elif segment == "SEG02":
        return f"{base} 결과"
    elif segment == "SEG03":
        return f"{name}님 {base}"
    elif segment == "SEG04":
        return f"{base}"
    return f"{name}님 {base}"


def _infer_status(intent: str, sections: list) -> dict:
    """데이터에서 overall_status 추론."""
    # alert_list가 있으면 warning, 없으면 normal
    has_alerts = any(s.get("section_type") == "alert_list" for s in sections)
    if has_alerts:
        return {"level": "caution", "label": "주의", "reason": "리스크 신호 감지"}
    return {"level": "normal", "label": "정상", "reason": ""}


def _extract_actions(sections: list) -> list:
    """sections에서 action_list를 추출하여 recommended_actions으로."""
    for s in sections:
        if s.get("section_type") == "action_list":
            return s.get("content", {}).get("items", [])
    return []


def _get_disclaimer(segment: str | None) -> str:
    """세그먼트별 disclaimer."""
    if segment == "SEG01":
        return "투자 의사결정은 본인의 판단과 책임 하에 이루어져요. 걱정되시면 담당 PB님과 상담해보세요 🙏"
    elif segment == "SEG02":
        return ""
    elif segment == "SEG03":
        return "최종 판단은 본인 책임 하에 이루어집니다."
    elif segment == "SEG04":
        return "본인 판단 하에 실행."
    return ""
