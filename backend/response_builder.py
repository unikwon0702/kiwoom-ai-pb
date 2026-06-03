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

# 전체 구조화 overhead 제한 (4초 - multi-table 조회 시간 확보)
MAX_OVERHEAD_SEC = 4.0
# Intent confidence 최소 기준
MIN_CONFIDENCE = 0.4


def build_structured_response(
    genie_result: dict,
    customer_id: str,
    customer_name: str | None,
    segment: str | None,
    db: DBClient,
    question: str = "",
    pre_fetched_extra: dict | None = None,
) -> dict | None:
    """
    Genie 응답을 받아 구조화 JSON을 생성.
    pre_fetched_extra: app.py에서 병렬 조회된 보강 데이터 (None이면 내부에서 조회)
    
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

        # Intent별 응답 전략 결정
        is_lookup_intent = intent in ("portfolio_allocation_summary", "holding_loss_detail", "holding_profit_detail")

        # 2. Genie table_data에서 sections 생성 + row_dict 추출 (상태 판정용)
        table_data = genie_result.get("table_data")
        row_dict = None
        if table_data:
            columns = table_data.get("columns", [])
            rows = table_data.get("rows", [])
            if rows and len(rows) == 1:
                row_dict = {columns[i]: rows[0][i] for i in range(len(columns))}
        sections = _build_sections_from_genie(intent, table_data)

        # 3. 보강 데이터: pre_fetched 있으면 재조회 skip, 없으면 직접 조회
        extra = None
        if not is_lookup_intent:
            extra = pre_fetched_extra
            if extra is None:
                elapsed = time.time() - start
                remaining = MAX_OVERHEAD_SEC - elapsed
                if remaining > 0.3:
                    extra = fetch_supplemental(intent, customer_id, db)
            if extra:
                extra_sections = _build_sections_from_cache(intent, extra)
                sections.extend(extra_sections)

        # 3-b. Genie timeout 시 row_dict를 보강 데이터(diagnosis)에서 복원
        if row_dict is None and extra and extra.get("diagnosis"):
            row_dict = extra["diagnosis"][0]

        # 4. 빈 sections 이면 fallback
        if not sections:
            return None

        # 5. 액션 추출 후 sections에서 action_list 제거 (중복 렌더링 방지)
        actions = [] if is_lookup_intent else _extract_actions(sections)
        if actions:
            sections = [s for s in sections if s.get("section_type") != "action_list"]

        # 6. Status 판정 먼저 (요약과의 일관성 검증용)
        status = _infer_status(intent, sections, row_dict)

        # 7. Summary 생성 + 일관성 검증
        raw_summary = _truncate_summary(genie_result.get("answer", ""), segment, intent)
        summary = _ensure_summary_consistency(raw_summary, status, row_dict, customer_name, segment, intent)

        # 8. JSON 조립
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
                "data_quality": "sufficient" if len(sections) >= 2 else "partial",
            },
            "headline": _build_headline(intent, customer_name, segment),
            "summary": summary,
            "overall_status": status,
            "sections": sections,
            "recommended_actions": actions,
            "disclaimer": _get_disclaimer(segment) if not is_lookup_intent else "",
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
    # 추가 매핑 (Genie 반환 컨럼)
    "asset_type": "자산유형",
    "purchase_amount": "매수금액",
    "purchase_price": "매수가",
    "quantity": "수량",
    "weight": "비중",
    "return_rate": "수익률",
    "profit_loss": "손익",
    "profit_loss_amount": "손익금액",
    "stock_name": "종목명",
    "product_name": "상품명",
    "product_type": "상품유형",
    "maturity_date": "만기일",
    "issue_date": "발행일",
    "asset_class": "자산군",
    "sub_asset_type": "세부유형",
    "market_value": "시장가치",
    "book_value": "장부가",
    "unrealized_pnl": "미실현손익",
    # 추가: Genie가 반환할 수 있는 모든 컨럼
    "name": "명칭",
    "type": "유형",
    "status": "상태",
    "date": "날짜",
    "description": "설명",
    "count": "건수",
    "total": "합계",
    "avg": "평균",
    "max": "최대",
    "min": "최소",
    "ratio": "비율",
    "amount": "금액",
    "price": "가격",
    "value": "값",
    "score": "점수",
    "level": "등급",
    "grade": "등급",
    "rank": "순위",
    "rate": "비율",
    "change": "변동",
    "change_rate": "변동률",
    "change_amount": "변동금액",
    "prev_close": "전일 종가",
    "open_price": "시가",
    "high_price": "고가",
    "low_price": "저가",
    "close_price": "종가",
    "volume": "거래량",
    "turnover": "거래대금",
    "market_cap": "시가총액",
    "dividend_yield": "배당수익률",
    "eps": "EPS",
    "bps": "BPS",
    "roe": "ROE",
    "roa": "ROA",
    "debt_ratio": "부채비율",
    "operating_profit": "영업이익",
    "net_income": "순이익",
    "revenue": "매출액",
    "duration": "듀레이션",
    "coupon_rate": "표면금리",
    "yield_to_maturity": "만기수익률",
    "credit_rating": "신용등급",
    "nav": "NAV",
    "expense_ratio": "보보수수료",
    "benchmark": "벤치마크",
    "tracking_error": "추적오차",
    "total_assets": "총 자산",
    "inception_date": "설정일",
    "fund_manager": "펀드매니저",
    "investment_region": "투자 지역",
    "investment_strategy": "투자 전략",
    "underlying_asset": "기초자산",
    "knock_in": "녹인",
    "knock_in_barrier": "녹인 배리어",
    "early_redemption": "조기상환",
    "remaining_days": "잔여일",
    "interest_rate": "금리",
    "base_rate": "기준금리",
    "exchange_rate": "환율",
    "usd_krw": "달러/원",
    "vix": "VIX",
    "kospi": "KOSPI",
    "kosdaq": "KOSDAQ",
    "s_and_p_500": "S&P500",
    "nasdaq": "NASDAQ",
    "oil_price": "유가",
    "gold_price": "금가격",
    "created_at": "생성일",
    "updated_at": "수정일",
    "expired_at": "만료일",
    "start_date": "시작일",
    "end_date": "종료일",
    "trade_date": "거래일",
    "settlement_date": "결제일",
    "portfolio_as_of_date": "포트폴리오 기준일",
    "preferred_product_group": "선호 상품군",
    "stock_holding_count": "주식 보유 수",
    "etf_holding_count": "ETF 보유 수",
    "fund_holding_count": "펀드 보유 수",
    "bond_holding_count": "채권 보유 수",
    "derivative_holding_count": "파생상품 보유 수",
    "overseas_ratio": "해외 비율",
    "domestic_ratio": "국내 비율",
    "stock_ratio": "주식 비율",
    "cash_like_ratio": "현금성 비율",
    # Genie 집계 컨럼 (스크린샷에서 확인된 누락)
    "total_weight": "비중",
    "total_valuation": "평가금액",
    "total_pnl": "손익",
    "total_count": "종목 수",
    "total_purchase": "매수금액",
    "avg_return": "평균 수익률",
    "avg_weight": "평균 비중",
    "sum_valuation": "이 평가금액",
    "sum_pnl": "총 손익",
    "max_weight": "최대 비중",
    "min_return_rate": "최저 수익률",
    "max_return_rate": "최고 수익률",
    "pnl": "손익",
    "pnl_amount": "손익금액",
    "avg_buy_price": "평균 매수가",
    "current_price": "현재가",
    "holding_period_days": "보유 기간(일)",
    "holding_quantity": "보유 수량",
    "valuation_profit_loss_amount": "평가손익",
    "valuation_return_rate": "평가수익률",
    "average_buy_price": "평균매수가",
}


def _get_korean_column_name(col: str) -> str:
    """
    컨럼명을 한글로 변환.
    1. COLUMN_DISPLAY_NAMES 매핑에 있으면 사용
    2. 없으면 snake_case를 자동 변환 (word별 부분 매핑)
    """
    # 1. 정확한 매핑
    if col in COLUMN_DISPLAY_NAMES:
        return COLUMN_DISPLAY_NAMES[col]

    # 2. 자동 변환: snake_case 단어별 한글 매핑 시도
    WORD_MAP = {
        "total": "총", "avg": "평균", "max": "최대", "min": "최소",
        "count": "수", "sum": "합계", "amount": "금액", "rate": "비율",
        "ratio": "비율", "score": "점수", "level": "등급", "weight": "비중",
        "price": "가격", "value": "값", "name": "명", "type": "유형",
        "date": "일자", "status": "상태", "signal": "신호",
        "return": "수익률", "profit": "수익", "loss": "손실",
        "asset": "자산", "stock": "주식", "bond": "채권", "fund": "펀드",
        "etf": "ETF", "holding": "보유", "portfolio": "포트폴리오",
        "customer": "고객", "market": "시장", "risk": "위험",
        "domestic": "국내", "foreign": "해외", "overseas": "해외",
        "current": "현재", "target": "목표", "previous": "이전",
        "investment": "투자", "valuation": "평가", "purchase": "매수",
        "sector": "섹터", "industry": "업종", "category": "분류",
        "change": "변동", "period": "기간", "days": "일",
        "concentration": "집중도", "diversification": "분산",
        "rebalance": "리밸런싱", "alert": "알림",
    }

    parts = col.lower().split("_")
    translated = [WORD_MAP.get(p, p) for p in parts]
    result = " ".join(translated)

    # 전체가 영어로만 구성되면 원본 그대로 (fallback)
    if all(c.isascii() for c in result.replace(" ", "")):
        return col  # 변환 실패 → 원본 컨럼명 표시

    return result

# 표시하지 않을 컨럼 (customer_id 등 내부용)
HIDDEN_COLUMNS = {"customer_id", "account_id", "holding_id", "asset_id", "scenario_id", "investor_profile_id"}


# ============================================================
# Genie table_data → Sections (인텐트별 핵심 선별 + 차트 분리)
# ============================================================

# Intent별 핵심 지표 필드 정의 (표시명, 등급 배지)
PORTFOLIO_KEY_METRICS = [
    # (column_name, display_label, badge_fn)
    # badge_fn은 아이콘+텍스트 라벨을 반환
    ("total_valuation_amount", "총 평가금액", lambda v: ""),
    ("valuation_amount", "총 평가금액", lambda v: ""),
    ("total_return_rate", "전체 수익률", lambda v: "🟢 수익" if v and float(v) > 0 else "🔴 손실"),
    ("avg_return_rate", "평균 수익률", lambda v: "🟢 수익" if v and float(v) > 0 else "🔴 손실"),
    ("avg_return", "평균 수익률", lambda v: "🟢 수익" if v and float(v) > 0 else "🔴 손실"),
    ("portfolio_risk_level", "포트폴리오 위험등급", lambda v: "🔴 위험" if v and "높" in str(v) else ("🟠 주의" if v and "중" in str(v) else "🟢 정상")),
    ("risk_signal_count", "리스크 신호", lambda v: "🔴 위험" if v and int(float(v)) >= 10 else ("🟠 주의" if v and int(float(v)) >= 4 else "🟢 정상")),
    ("total_holding_count", "보유 종목 수", lambda v: ""),
    ("diversification_score", "분산 점수", lambda v: "🔴 위험" if v and float(v) <= 1.5 else ("🟠 주의" if v and float(v) <= 3.0 else "🟢 양호")),
    ("concentration_level", "집중도", lambda v: "🔴 위험" if v and "높" in str(v) else ("🟠 주의" if v and "중" in str(v) else "🟢 낮음")),
    ("loss_asset_count", "손실 종목 수", lambda v: "🔴 위험" if v and int(float(v)) >= 4 else ("🟠 주의" if v and int(float(v)) >= 2 else "")),
]

# 도넛 차트용 비율 필드
RATIO_FIELDS = [
    ("domestic_ratio", "국내주식"),
    ("domestic_stock_ratio", "국내주식"),
    ("overseas_ratio", "해외주식"),
    ("foreign_stock_ratio", "해외주식"),
    ("stock_ratio", "주식"),
    ("etf_ratio", "ETF"),
    ("fund_ratio", "펀드"),
    ("bond_ratio", "채권"),
    ("derivative_ratio", "파생상품"),
    ("cash_like_ratio", "현금성"),
]


def _build_sections_from_genie(intent: str, table_data: dict | None) -> list:
    """Genie가 반환한 table_data를 intent별로 핵심 선별하여 sections으로 변환."""
    if not table_data:
        return []

    columns = table_data.get("columns", [])
    rows = table_data.get("rows", [])
    if not columns or not rows:
        return []

    # 컨럼명 → 값 dict 생성 (1행인 경우)
    if len(rows) == 1:
        row_dict = {columns[i]: rows[0][i] for i in range(len(columns))}
        return _build_single_row_sections(intent, row_dict)
    else:
        # 복수 행: 종목별 카드 형태
        return _build_multi_row_sections(intent, columns, rows)


def _build_single_row_sections(intent: str, row_dict: dict) -> list:
    """단일 행 데이터를 핵심 지표 + 도넛 차트로 변환."""
    sections = []

    # --- Section 1: 핵심 지표 테이블 (5~6개만 선별) ---
    metrics_rows = []
    seen_labels = set()
    for col_name, label, badge_fn in PORTFOLIO_KEY_METRICS:
        if label in seen_labels:
            continue
        val = row_dict.get(col_name)
        if val is not None and val != "" and str(val).lower() != "none":
            formatted = _format_value(val, col_name)
            try:
                badge = badge_fn(val) if badge_fn else ""
            except (ValueError, TypeError):
                badge = ""
            metrics_rows.append([label, formatted, badge])
            seen_labels.add(label)
        if len(metrics_rows) >= 6:
            break

    if metrics_rows:
        sections.append({
            "section_type": "metrics_table",
            "title": "종합 등급",
            "icon": "🧨",
            "content": {
                "headers": ["항목", "수치", "등급"],
                "rows": metrics_rows,
            }
        })

    # --- Section 2: 자산 배분 도넛 차트 ---
    chart_data = []
    seen_chart_labels = set()
    for col_name, chart_label in RATIO_FIELDS:
        if chart_label in seen_chart_labels:
            continue
        val = row_dict.get(col_name)
        if val is not None:
            try:
                num_val = float(val)
                if num_val > 0:
                    # 비율이 0~1 사이면 %로 변환
                    pct = num_val * 100 if num_val <= 1.0 else num_val
                    chart_data.append({"name": chart_label, "value": round(pct, 1)})
                    seen_chart_labels.add(chart_label)
            except (ValueError, TypeError):
                pass

    if chart_data:
        # 기타 계산 (100%에서 나머지)
        total = sum(d["value"] for d in chart_data)
        if total < 99:
            chart_data.append({"name": "기타", "value": round(100 - total, 1)})

        sections.append({
            "section_type": "chart_data",
            "title": "자산 배분 구성",
            "icon": "🥧",
            "content": {
                "chart_type": "donut",
                "data": chart_data,
            }
        })

    return sections


# Intent별 우선 표시 컨럼 (순서대로 우선 선택)
PRIORITY_COLUMNS = {
    "portfolio_allocation_summary": [
        "asset_name", "stock_name", "product_name", "name",  # 종목/상품명
        "asset_type", "product_type", "type",  # 유형
        "holding_weight", "weight", "ratio", "total_weight",  # 비중
        "valuation_amount", "market_value", "amount", "total_valuation",  # 평가금액
        "purchase_amount", "book_value",  # 매수금액
        "valuation_return_rate", "return_rate", "total_pnl",  # 수익/손익
    ],
    "holding_loss_detail": [
        "asset_name", "stock_name", "product_name", "name",  # 종목명
        "valuation_profit_loss_amount", "profit_loss_amount", "profit_loss", "total_pnl",  # 손익금액
        "valuation_return_rate", "return_rate",  # 수익률
        "valuation_amount", "market_value", "total_valuation",  # 평가금액
        "holding_weight", "weight", "total_weight",  # 비중
        "asset_type", "product_type",  # 유형
    ],
    "holding_profit_detail": [
        "asset_name", "stock_name", "product_name", "name",  # 종목명
        "valuation_profit_loss_amount", "profit_loss_amount", "profit_loss", "total_pnl",  # 수익금액
        "valuation_return_rate", "return_rate",  # 수익률
        "valuation_amount", "market_value", "total_valuation",  # 평가금액
        "holding_weight", "weight", "total_weight",  # 비중
        "asset_type", "product_type",  # 유형
    ],
    "portfolio_diagnosis": [
        "asset_name", "stock_name", "name",
        "holding_weight", "weight",
        "valuation_amount",
        "valuation_return_rate", "return_rate",
        "signal_name", "risk_notice_required",
    ],
    "holding_risk_check": [
        "asset_name", "stock_name", "name",
        "signal_name", "signal_category",
        "interpretation", "signal_interpretation",
        "risk_notice_required",
        "holding_weight",
    ],
    "risk_alert": [
        "asset_name", "signal_name",
        "signal_category", "interpretation",
        "risk_notice_required",
        "impact_level", "title",
    ],
}


def _build_multi_row_sections(intent: str, columns: list, rows: list) -> list:
    """복수 행 데이터를 Intent별 핵심 컨럼만 선별하여 테이블 + 차트로 변환."""
    sections = []

    # Intent별 우선 컨럼 선택
    priority_cols = PRIORITY_COLUMNS.get(intent, [])

    # 우선순위에 따라 컨럼 선택 (있는 것만, 최대 5개)
    display_cols = []
    for col_name in priority_cols:
        if col_name in columns:
            idx = columns.index(col_name)
            if idx not in display_cols:
                display_cols.append(idx)
        if len(display_cols) >= 5:
            break

    # 우선 컨럼이 3개 미만이면 fallback: 내부 ID 제외 후 앞에서 5개
    if len(display_cols) < 3:
        display_cols = []
        for i, c in enumerate(columns):
            if c.lower() in HIDDEN_COLUMNS:
                continue
            if c in ("customer_name",):
                continue
            display_cols.append(i)
            if len(display_cols) >= 5:
                break

    if not display_cols:
        return []

    display_headers = [_get_korean_column_name(columns[i]) for i in display_cols]
    display_rows = []
    for row in rows[:8]:
        display_rows.append([_format_value(row[i], columns[i]) for i in display_cols])

    title_map = {
        "portfolio_allocation_summary": "자산 유형별 현황",
        "holding_loss_detail": "손실 종목 현황",
        "holding_profit_detail": "수익 종목 현황",
        "portfolio_diagnosis": "보유 종목 현황",
        "holding_risk_check": "종목별 위험도",
        "risk_alert": "위험 신호 목록",
    }
    title = title_map.get(intent, "데이터 요약")
    sections.append({
        "section_type": "metrics_table",
        "title": title,
        "icon": "📊",
        "content": {
            "headers": display_headers,
            "rows": display_rows,
        }
    })

    # --- 조회형 intent: 비중 컨럼이 있으면 도넛 차트 자동 생성 ---
    if intent == "portfolio_allocation_summary":
        # 종목명 + 비중 컨럼 찾기
        name_idx = None
        weight_idx = None
        for i, c in enumerate(columns):
            if c in ("asset_name", "stock_name", "product_name", "name") and name_idx is None:
                name_idx = i
            if c in ("holding_weight", "weight", "ratio") and weight_idx is None:
                weight_idx = i

        if name_idx is not None and weight_idx is not None:
            chart_data = []
            for row in rows[:10]:
                name = str(row[name_idx]) if row[name_idx] else "?"
                try:
                    w = float(row[weight_idx])
                    pct = w * 100 if w <= 1.0 else w
                    if pct > 0:
                        chart_data.append({"name": name, "value": round(pct, 1)})
                except (ValueError, TypeError):
                    pass

            if chart_data:
                total = sum(d["value"] for d in chart_data)
                if total < 99:
                    chart_data.append({"name": "기타", "value": round(100 - total, 1)})

                sections.append({
                    "section_type": "chart_data",
                    "title": "비중 분포",
                    "icon": "🥧",
                    "content": {
                        "chart_type": "donut",
                        "data": chart_data,
                    }
                })

    return sections


# ============================================================
# app_cache 데이터 → Sections
# ============================================================

def _build_sections_from_cache(intent: str, extra: dict) -> list:
    """
    Multi-source 보강 데이터를 intent별 풍부한 sections으로 변환.
    extra: { "diagnosis": [...], "signals": [...], "insight_cards": [...], "rebalancing": [...] }
    """
    if not extra:
        return []

    sections = []

    # --- 1. 자산 배분 도넛 차트 (diagnosis 데이터) ---
    diagnosis_rows = extra.get("diagnosis", [])
    if diagnosis_rows:
        row = diagnosis_rows[0]
        chart_data = []
        for field, label in [("domestic_stock_ratio", "국내주식"), ("foreign_stock_ratio", "해외주식"),
                             ("etf_ratio", "ETF"), ("fund_ratio", "펀드"),
                             ("bond_ratio", "채권"), ("derivative_ratio", "파생결합증권")]:
            val = row.get(field)
            if val is not None:
                try:
                    num = float(val)
                    if num > 0:
                        chart_data.append({"name": label, "value": round(num * 100, 1)})
                except (ValueError, TypeError):
                    pass
        if chart_data:
            total = sum(d["value"] for d in chart_data)
            if total < 99:
                chart_data.append({"name": "기타", "value": round(100 - total, 1)})
            sections.append({"section_type": "chart_data", "title": "자산 배분 구성", "icon": "🥧",
                             "content": {"chart_type": "donut", "data": chart_data}})

    # --- 2. 보유종목 신호 ---
    signal_rows = extra.get("signals", [])
    if signal_rows:
        items = []
        for r in signal_rows[:7]:
            level = "warning" if r.get("risk_notice_required") else "caution"
            items.append({"level": level,
                          "title": f"{r.get('asset_name', '')} — {r.get('signal_name', '')}",
                          "detail": r.get("signal_interpretation", ""), "date": ""})
        if items:
            sections.append({"section_type": "alert_list", "title": "보유종목 신호", "icon": "📡",
                             "content": {"items": items}})

    # --- 3. 알림 카드 (액션 권고 포함) ---
    card_rows = extra.get("insight_cards", [])
    if card_rows:
        items = []
        for r in card_rows[:3]:
            level = "warning" if r.get("impact_level") == "HIGH" else "caution"
            # 요약 + 액션 권고를 함께 표시
            detail_parts = []
            summary_text = r.get("summary", "")
            action_rec = r.get("action_recommendation", "")
            if summary_text:
                detail_parts.append(summary_text)
            if action_rec:
                detail_parts.append(f"→ {action_rec}")
            items.append({"level": level, "title": r.get("title", ""),
                          "detail": " | ".join(detail_parts) if detail_parts else "",
                          "date": str(r.get("published_at", ""))[:10]})
        if items:
            sections.append({"section_type": "alert_list", "title": "알림 후보", "icon": "⚠️",
                             "content": {"items": items}})

    # --- 4. 액션 아이템 ---
    rebal_rows = extra.get("rebalancing", [])
    if rebal_rows:
        row = rebal_rows[0]
        action_items = []
        s = row.get("rebalance_action_summary", "")
        if s:
            action_items.append({"priority": 1, "action": s,
                                 "reason": f"긴급도: {row.get('rebalance_urgency','MEDIUM')}",
                                 "urgency": (row.get("rebalance_urgency") or "medium").lower()})
        lc = row.get("loss_cut_candidates", "")
        if lc and str(lc) != "None":
            action_items.append({"priority": 2, "action": f"손절 검토: {lc}",
                                 "reason": "수익률 -15% 이하", "urgency": "high"})
        ow = row.get("overweight_assets", "")
        if ow and str(ow) != "None":
            action_items.append({"priority": 3, "action": f"비중 축소: {ow}",
                                 "reason": "25% 이상 집중", "urgency": "medium"})
        if action_items:
            sections.append({"section_type": "action_list", "title": "다음 액션 제안", "icon": "💡",
                             "content": {"items": action_items}})

    return sections


# ============================================================
# 보조 함수
# ============================================================

import re as _re


# Intent별 timeout 시 템플릿 summary
_TIMEOUT_SUMMARIES = {
    "portfolio_diagnosis": {
        "SEG01": "포트폴리오 종합 진단 결과를 아래에 정리해드렸어요.",
        "SEG02": "진단 결과 요약.",
        "SEG03": "포트폴리오 종합 진단 결과입니다.",
        "SEG04": "진단 결과.",
    },
    "risk_alert": {
        "SEG01": "현재 위험 신호를 정리해드릴게요.",
        "SEG02": "위험 신호 요약.",
        "SEG03": "리스크 신호 점검 결과입니다.",
        "SEG04": "위험 신호.",
    },
    "rebalancing_recommendation": {
        "SEG01": "리밸런싱 추천 내용을 아래에 정리해드렸어요.",
        "SEG02": "리밸런싱 요약.",
        "SEG03": "리밸런싱 분석 결과입니다.",
        "SEG04": "리밸런싱.",
    },
    "holding_risk_check": {
        "SEG01": "보유 종목 위험도를 점검해드렸어요.",
        "SEG02": "종목 위험도 점검.",
        "SEG03": "보유 종목별 위험도 점검 결과입니다.",
        "SEG04": "위험도 점검.",
    },
}


def _truncate_summary(text: str, segment: str | None = None, intent: str = "") -> str:
    """
    Genie 답변을 summary용으로 축약.
    Genie timeout/실패 시 템플릿 summary 생성.
    """
    # Genie timeout/실패 감지 → 템플릿 사용
    if not text or "시간 초과" in text or "응답 생성 실패" in text:
        templates = _TIMEOUT_SUMMARIES.get(intent, {})
        fallback = templates.get(segment) or templates.get("SEG01", "")
        return fallback or "분석 결과를 아래에 정리해드렸습니다."

    # 세그먼트별 최대 문장 수
    max_sentences = 1 if segment in ("SEG02", "SEG04") else 2

    # 한국어 문장 끝 패턴 (요, 죠, 다, . 뒤 공백)
    sentences = _re.split(r'(?<=[.요죠다])\s+', text.strip())
    if len(sentences) <= max_sentences:
        return text.strip()

    truncated = " ".join(sentences[:max_sentences])
    # 마지막 문자가 문장부호가 아니면 추가
    if not truncated.endswith((".", "요", "죠", "다")):
        truncated += "."

    return truncated


# 위험 상태인데 안심 표현이 나오는 모순을 방지
_REASSURING_PATTERNS = [
    "안심", "걸정 안", "걸정하지", "괜찮", "양호한 편", "양호합니다",
    "좋은 성과", "긍정적인 성과", "잘 분산", "잘 구성",
    "만족스러", "무난", "좋은 편", "안정적",
]


def _ensure_summary_consistency(
    summary: str, status: dict, row_dict: dict | None,
    customer_name: str | None, segment: str | None, intent: str
) -> str:
    """
    overall_status와 summary가 모순되지 않도록 검증.
    예: status=위험인데 summary가 "안심하셔도 돼요" → 데이터 기반 summary로 교체.
    """
    if not summary:
        return summary

    level = status.get("level", "")

    # warning/critical 상태인데 안심 표현이 있으면 → 교체
    if level in ("warning", "critical"):
        has_reassuring = any(p in summary for p in _REASSURING_PATTERNS)
        if has_reassuring:
            return _generate_data_driven_summary(status, row_dict, customer_name, segment, intent)

    # caution 상태에서도 "안심" 같은 강한 안전 표현은 제거
    if level == "caution" and summary:
        for p in ["안심하셔도 돼요", "걸정 안 하셔도 돼요", "걸정하지 않으셔도 돼요"]:
            summary = summary.replace(p, "점검이 필요해 보여요")

    return summary


def _generate_data_driven_summary(
    status: dict, row_dict: dict | None,
    customer_name: str | None, segment: str | None, intent: str
) -> str:
    """
    Status와 일관된 summary를 실제 데이터에서 생성.
    """
    name = customer_name or ""
    reason = status.get("reason", "")

    # row_dict에서 핵심 수치 추출
    risk_level = ""
    avg_return = ""
    loss_count = ""
    if row_dict:
        rl = row_dict.get("portfolio_risk_level", "")
        if rl:
            risk_level = f"위험등급 {rl}"
        ar = row_dict.get("avg_return")
        if ar is not None:
            try:
                avg_return = f"평균 수익률 {float(ar)*100:.1f}%"
            except (ValueError, TypeError):
                pass
        lc = row_dict.get("loss_asset_count")
        if lc is not None:
            try:
                loss_count = f"손실 종목 {int(float(lc))}개"
            except (ValueError, TypeError):
                pass

    # 세그먼트별 생성
    if segment == "SEG01":
        parts = [f"{name}님, 현재 포트폴리오 {risk_level}으로 나타나고 있어요."]
        if reason:
            parts.append(f"{reason} 상황이라 조금 주의가 필요해 보여요.")
        return " ".join(parts)
    elif segment == "SEG02":
        items = [risk_level, avg_return, loss_count]
        return " / ".join(i for i in items if i) + ". 점검 필요."
    elif segment == "SEG03":
        parts = [f"포트폴리오 {risk_level} 상태입니다."]
        if reason:
            parts.append(f"주요 요인: {reason}.")
        return " ".join(parts)
    elif segment == "SEG04":
        items = [risk_level, reason]
        return " / ".join(i for i in items if i) + "."
    else:
        return f"{name}님 포트폴리오 {risk_level}. {reason}" if reason else f"포트폴리오 {risk_level}."


def _format_value(v, col_name: str = "") -> str:
    """
    None, 숫자 등을 사용자 친화적 문자열로 변환.
    과학적 표기법, raw 소수값 등을 적절히 포맷팅.
    """
    if v is None:
        return "-"

    # 문자열을 숫자로 변환 시도
    num_val = None
    if isinstance(v, (int, float)):
        num_val = float(v)
    elif isinstance(v, str):
        # 과학적 표기법 (3.89E8) 처리
        try:
            num_val = float(v)
        except (ValueError, TypeError):
            pass

    if num_val is None:
        # 순수 문자열 (높음, 낮음 등)
        return str(v)

    # 컨럼명 기반 포맷 결정
    col_lower = col_name.lower() if col_name else ""

    # 건수 필드 우선 (count 키워드가 있으면 금액보다 우선)
    if "count" in col_lower:
        return f"{int(num_val)}개"

    # 비율/수익률 필드 (ratio, rate, return, weight) — 금액보다 우선!
    # valuation_return_rate 같은 컨럼이 "valuation" 때문에 금액으로 잘못 잡히는 것 방지
    if any(kw in col_lower for kw in ["ratio", "rate", "return", "weight"]):
        if abs(num_val) <= 1.0:
            return f"{num_val * 100:.1f}%"
        else:
            return f"{num_val:.1f}%"

    # 금액 필드 (amount, valuation, profit, loss, price, pnl)
    if any(kw in col_lower for kw in ["amount", "valuation_amount", "profit", "loss", "price", "total_profit", "total_loss", "pnl", "valuation", "purchase"]):
        if abs(num_val) >= 100_000_000:  # 1억 이상
            return f"{num_val/100_000_000:.1f}억원"
        elif abs(num_val) >= 10_000:  # 1만 이상
            return f"{num_val/10_000:.0f}만원"
        else:
            return f"{num_val:,.0f}원"

    # 건수 필드 (count)
    if "count" in col_lower:
        return f"{int(num_val)}개"

    # 신호 수 (signal)
    if "signal" in col_lower and num_val == int(num_val):
        return f"{int(num_val)}건"

    # 점수 필드 (score)
    if "score" in col_lower:
        return f"{num_val:.1f}"

    # 기본: 큰 숫자는 금액, 작은 숫자는 비율로 추정
    if abs(num_val) >= 100_000_000:
        return f"{num_val/100_000_000:.1f}억원"
    elif abs(num_val) >= 1_000_000:
        return f"{num_val/10_000:.0f}만원"
    elif abs(num_val) < 1 and abs(num_val) > 0:
        return f"{num_val * 100:.1f}%"
    elif num_val == int(num_val) and abs(num_val) < 1000:
        return f"{int(num_val)}"
    else:
        return f"{num_val:,.0f}"


def _build_headline(intent: str, customer_name: str | None, segment: str | None) -> str:
    """intent + 세그먼트별 headline 생성."""
    name = customer_name or ""
    titles = {
        "portfolio_allocation_summary": "자산 구성 현황",
        "holding_loss_detail": "손실 종목 현황",
        "holding_profit_detail": "수익 종목 현황",
        "portfolio_diagnosis": "포트폴리오 종합 진단",
        "rebalancing_recommendation": "리밸런싱 추천",
        "holding_risk_check": "보유 종목 위험도 점검",
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


def _infer_status(intent: str, sections: list, row_dict: dict | None = None) -> dict:
    """
    overall_status 판정. 실제 데이터 값 기반.
    
    판정 기준:
      - 위험: 리스크 신호 10건+, 또는 위험등급 '높음'
      - 주의: 리스크 신호 4~9건, 또는 위험등급 '중간'
      - 정상: 리스크 신호 0~3건, 위험등급 '낮음'
    """
    # 조회형 intent는 항상 info
    if intent in ("portfolio_allocation_summary", "holding_profit_detail"):
        return {"level": "info", "label": "조회", "reason": ""}

    # 손실 조회는 caution (status로 상태 알림)
    if intent == "holding_loss_detail":
        return {"level": "caution", "label": "손실 현황", "reason": "손실 중인 종목 현황"}

    # 실제 데이터 기반 판정
    if row_dict:
        risk_level = str(row_dict.get("portfolio_risk_level", ""))

        # 리스크 신호 수
        signal_count = 0
        for key in ["risk_signal_count", "signal_count"]:
            val = row_dict.get(key)
            if val is not None:
                try:
                    signal_count = int(float(val))
                    break
                except (ValueError, TypeError):
                    pass

        # 손실 종목 수
        loss_count = 0
        val = row_dict.get("loss_asset_count")
        if val is not None:
            try:
                loss_count = int(float(val))
            except (ValueError, TypeError):
                pass

        # 집중도
        concentration = str(row_dict.get("concentration_level", ""))

        # 판정 로직
        reasons = []

        # 위험 (danger)
        if "높" in risk_level or signal_count >= 10:
            if signal_count >= 10:
                reasons.append(f"리스크 신호 {signal_count}건")
            if "높" in risk_level:
                reasons.append("위험등급 높음")
            if "높" in concentration:
                reasons.append("집중도 높음")
            if loss_count >= 3:
                reasons.append(f"손실 종목 {loss_count}개")
            return {"level": "warning", "label": "위험", "reason": ", ".join(reasons) if reasons else "위험 수준 높음"}

        # 주의 (caution)
        if "중" in risk_level or 4 <= signal_count <= 9 or loss_count >= 2:
            if signal_count >= 4:
                reasons.append(f"리스크 신호 {signal_count}건")
            if loss_count >= 2:
                reasons.append(f"손실 종목 {loss_count}개")
            return {"level": "caution", "label": "주의", "reason": ", ".join(reasons) if reasons else "점검 필요"}

    # Fallback: alert_list 존재 여부
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
