"""
Intent Router — Phase A PoC
LLM 기반 intent 분류. 경량 모델로 질문 해석 → intent + 필요 테이블 결정.
"""
import logging
from backend.llm_client import LLMClient

logger = logging.getLogger("intent_router")

# ============================================================
# Intent 정의 + 필요 데이터 매핑
# ============================================================

SCHEMA = "dev.ai_pb_gold"

INTENT_TABLE_MAP = {
    "portfolio_diagnosis": [
        f"{SCHEMA}.gd_serving_portfolio_diagnosis",
        f"{SCHEMA}.gd_customer_portfolio_signal",
        f"{SCHEMA}.gd_pb_insight_card",
        f"{SCHEMA}.gd_serving_rebalancing_action",
    ],
    "risk_alert": [
        f"{SCHEMA}.gd_customer_portfolio_signal",
        f"{SCHEMA}.gd_pb_insight_card",
    ],
    "holding_risk_check": [
        f"{SCHEMA}.gd_customer_portfolio_signal",
    ],
    "rebalancing_recommendation": [
        f"{SCHEMA}.gd_serving_rebalancing_action",
    ],
    "portfolio_allocation_summary": [
        f"{SCHEMA}.gd_serving_portfolio_diagnosis",
    ],
    "holding_loss_detail": [
        f"{SCHEMA}.gd_customer_portfolio_signal",
    ],
    "holding_profit_detail": [
        f"{SCHEMA}.gd_customer_portfolio_signal",
    ],
    "news_disclosure_impact": [
        f"{SCHEMA}.app_cache_news_feed",
    ],
    "theme_supply_demand": [
        f"{SCHEMA}.app_cache_news_feed",
    ],
    "holding_asset_analysis": [
        f"{SCHEMA}.gd_customer_portfolio_signal",
        f"{SCHEMA}.app_cache_holding_signals",
    ],
    "market_context_analysis": [
        f"{SCHEMA}.app_cache_market_overview",
    ],
    "general_financial_qna": [],
    # ── Phase 2: 신규 카드 인텐트 ─────────────────────────────────────────
    "investment_change_summary": [
        f"{SCHEMA}.app_cache_holding_signals",
    ],
    "investment_change_detail": [
        f"{SCHEMA}.app_cache_holding_signals",
        f"{SCHEMA}.gd_customer_portfolio_signal",
    ],
    "market_event_summary": [
        f"{SCHEMA}.app_cache_market_events",
    ],
    "market_event_detail": [
        f"{SCHEMA}.app_cache_market_events",
    ],
    "upcoming_schedule_summary": [
        f"{SCHEMA}.app_cache_schedule_events",
    ],
    "upcoming_schedule_detail": [
        f"{SCHEMA}.app_cache_schedule_events",
    ],
    "expert_movement_detail": [
        f"{SCHEMA}.app_cache_top_investors",
    ],
    "expert_type_detail": [
        f"{SCHEMA}.app_cache_top_investors",
    ],
    "news_signal_summary": [
        f"{SCHEMA}.app_cache_news_feed",
    ],
    "news_signal_detail": [
        f"{SCHEMA}.app_cache_news_feed",
    ],
    "fallback": [],
}

# ============================================================
# System Prompt
# ============================================================

ROUTER_SYSTEM_PROMPT = """You are an intent classifier for a Korean stock brokerage AI PB app.

Given a customer question, classify it into ONE intent from the list below.
Respond ONLY with a JSON object: {"intent": "...", "confidence": 0.0~1.0}

## Intents

- portfolio_diagnosis: 포트폴리오 종합 진단, 분산도, 위험도, 전체 성과 분석
- risk_alert: 위험 신호, 알림, 주의해야 할 것
- holding_risk_check: 보유 종목의 위험도 점검
- rebalancing_recommendation: 리밸런싱, 비중 조정, 매도 추천
- portfolio_allocation_summary: 자산 유형별 비중, 구성, 배분, 평가금액 합계 조회
- holding_loss_detail: 손실 중인 종목, 마이너스 종목 조회
- holding_profit_detail: 수익 중인 종목, 플러스 종목 조회
- news_disclosure_impact: 뉴스 영향, 공시, 이벤트가 포트폴리오에 미치는 영향
- theme_supply_demand: 테마/섹터 수급 동향, 외국인 매매, 업종 동향
- holding_asset_analysis: 특정 종목 분석, 종목 상태, 개별 자산 질문 (삼성전자 어때? 등)
- market_context_analysis: 시장 상황, 금리, 환율, 전망, 오늘 시장
- general_financial_qna: 금융 용어, 개념 설명 (MDD, 샤프비율 등)
- investment_change_summary: 내 투자 변동 전체 리스트 (보유종목 변동 있어?, 최근 내 투자 상황)
- investment_change_detail: 특정 보유 종목 상세 분석 (TIGER 글로벌메타버스 알려줘, 특정 종목명 + 변동/분석/상세)
- market_event_summary: 이벤트/시황 리스트 (지금 뜨는 이벤트, 이벤트·시황 보여줘, 오늘 주목할 이슈)
- market_event_detail: 특정 이벤트/시황 상세 (이벤트 제목으로 상세 요청)
- upcoming_schedule_summary: 다가오는 일정 리스트 (다가오는 일정, 앞으로 확인할 투자 일정, 이번 주 일정)
- upcoming_schedule_detail: 특정 일정 상세 (일정명으로 상세 요청, FOMC 금리결정/연준 회의/실적발표/배당 등 일정 이벤트 상세)
- expert_movement_detail: 고수 전체 움직임 (고수들 지금 어떻게 움직여, 투자고수 움직임, 고수 매매 흐름)
- expert_type_detail: 특정 유형 고수 (공격형 고수, 장기형 고수, 금상 고수)
- news_signal_summary: 의외의 신호 뉴스 리스트 (뉴스 알려줘, 지금 주목할 뉴스, 의외의 신호, 시장 뉴스 요약)
- news_signal_detail: 특정 뉴스 상세 (뉴스 제목 단독 질문, 또는 뉴스 제목 + 알려줘/상세)
- fallback: 위 어느 것에도 해당하지 않는 질문

## Rules
- "뉴스", "공시", "영향", "이벤트" → news_disclosure_impact (단, "뉴스 알려줘" 처럼 단독 뉴스 조회는 news_signal_summary)
- "수급", "외국인", "테마", "업종 동향" → theme_supply_demand
- 특정 종목명 + "어때", "분석", "상태" → holding_asset_analysis (단, 보유 종목명 + "변동/상세/알려줘" → investment_change_detail)
- "자산 비중", "평가금액 합계", "구성 확인" → portfolio_allocation_summary
- "손실", "마이너스", "떨어진" → holding_loss_detail
- "수익", "플러스", "올라간" → holding_profit_detail
- "매도", "리밸런싱", "비중 조정" → rebalancing_recommendation
- "위험", "알림", "주의" → risk_alert
- "진단", "분석", "종합" → portfolio_diagnosis
- "FOMC", "금리결정", "연준 회의", "기준금리 결정", "FOMC 금리" → upcoming_schedule_detail (시장 전망이 아닌 이벤트/일정 상세)
- "시장", "코스피", "금리 전망", "금리 수준", "환율" → market_context_analysis (단, "금리결정"/"FOMC"는 upcoming_schedule_detail)
- "내 투자 변동", "보유 종목 변동", "최근 내 투자 상황" → investment_change_summary
- 보유 종목 이름(예: TIGER 글로벌메타버스) 단독 or + "알려줘/상세" → investment_change_detail
- "이벤트 알려줘", "시황 보여줘", "주목할 이슈" → market_event_summary
- 이벤트 제목 그대로 질문 → market_event_detail
- "다가오는 일정", "투자 일정" → upcoming_schedule_summary
- 일정/이벤트 제목(FOMC 금리결정, 실적발표, 주총, 배당, ELS 평가 등) + "알려줘/상세/보여줘" → upcoming_schedule_detail
- "FOMC" 단독 또는 + "알려줘/금리결정/회의" → upcoming_schedule_detail (NOT market_context_analysis)
- "고수", "투자 고수" + 단독/전체 → expert_movement_detail
- 특정 유형(공격형/장기형/금상) + "고수" → expert_type_detail
- "뉴스 알려줘", "의외의 신호", "시장 뉴스 요약" → news_signal_summary
- 뉴스 제목 그대로 단독 질문(뉴스 리스트 아이템 클릭) 또는 뉴스 제목 + "알려줘/상세" → news_signal_detail (market_event_detail과 동일 패턴)
- 조회형 질문(확인, 보여줘, 얼마) vs 분석형 질문(진단, 분석) 구분 중요
- "자산 유형별 비중과 평가금액 합계 확인" → portfolio_allocation_summary (NOT portfolio_diagnosis)
- "손실 중인 종목 세부 현황" → holding_loss_detail (NOT portfolio_allocation_summary)
"""


# ============================================================
# Router Function
# ============================================================

# ============================================================
# Pre-Routing: LLM 호출 전 카테고리 기반 즉시 분류
# 특정 이름이 아닌 '이벤트 타입 카테고리' 기반 → 신규 이벤트 추가시 자동 대응
# ============================================================
_SCHEDULE_CATEGORY_KW = [
    # 매크로지표 (FOMC, CPI, GDP 등)
    'fomc', '금리결정', '연준', '기준금리', 'cpi', 'ppi', 'gdp',
    '소비자물가', '생산자물가', '소비자심리', '미시간대', '실업률', '비농업',
    # 주총/공시
    '주주총회', '주총', '소집공고', '임시주총', '정기주총',
    # 실적/공시
    '실적발표', '증권발행실적', '사업보고서', '분기보고서', '정기공시',
    # ELS/배당
    'els', '배당기준일', '배당락',
    # 외교/일정 이벤트
    '관세협상', 'g7', 'g20', '정상회담',
]
_DETAIL_TRIGGERS = [
    '알려줘', '상세', '보여줘', '설명', '에 대해', '대해', '뭐야',
    '알려', '어때', '궁금', '자세히', '알고싶어', '분석',
]

# ============================================================
# 의외의 신호 뉴스 키워드 기반 즉시 라우팅
# ============================================================
_NEWS_SIGNAL_SUMMARY_KW = [
    '의외의 신호', '주목할만한 신호', '주목할 신호', '의외의신호',
    '주목할 뉴스', '주목할만한 뉴스', '뉴스 알려줘', '뉴스 보여줘',
    '시장 뉴스', '투자 뉴스', '의외의 기회', '숨은 리스크',
    '투자 신호', '새로운 흐름', '오늘 뉴스', '요즘 뉴스',
    '지금 뉴스', '최신 뉴스', '최근 뉴스', '뉴스 요약',
    '의외 신호', '시장 신호', '투자에 영향', '투자 영향',
]

def _pre_route_news_signal(question: str) -> str | None:
    """
    의외의 신호 키워드 기반 즉시 라우팅.
    LLM이 fallback으로 오분류하는 것 방지.
    """
    q = question
    q_lower = q.lower()
    # 뉴스 관련 직접 표현
    if any(kw in q for kw in _NEWS_SIGNAL_SUMMARY_KW):
        return "news_signal_summary"
    # "뉴스" 단독 + 상세 트리거 없음 → summary
    if '뉴스' in q and not any(t in q for t in _DETAIL_TRIGGERS):
        return "news_signal_summary"
    return None


def _pre_route_schedule(question: str) -> str | None:
    """
    LLM 호출 전 일정/이벤트 카테고리 키워드 기반 즉시 라우팅.
    특정 이벤트명이 아닌 카테고리 단위 → 어떤 일정이 추가되어도 자동 대응.
    """
    q_lower = question.lower()
    has_schedule_kw = any(kw in q_lower for kw in _SCHEDULE_CATEGORY_KW)
    has_detail_trigger = any(t in question for t in _DETAIL_TRIGGERS)
    if has_schedule_kw and has_detail_trigger:
        return "upcoming_schedule_detail"
    return None


def route(question: str, llm: LLMClient) -> dict:
    """
    LLM 기반 intent 분류.
    
    Returns:
        {
            "intent": str,
            "confidence": float,
            "required_tables": list[str],
            "is_lookup": bool,
        }
    """
    # 1차: 카테고리 키워드 기반 즉시 분류 (LLM 오분류 방지)
    pre = _pre_route_news_signal(question)
    if pre:
        return {"intent": pre, "confidence": 0.95, "required_tables": INTENT_TABLE_MAP.get(pre, []), "is_lookup": True}
    pre = _pre_route_schedule(question)
    if pre:
        return {"intent": pre, "confidence": 0.95, "required_tables": INTENT_TABLE_MAP.get(pre, []), "is_lookup": True}

    # 2차: LLM 기반 분류
    result = llm.route_intent(
        question=f"사용자 질문: \"{question}\"",
        system_prompt=ROUTER_SYSTEM_PROMPT,
    )

    if not result or "intent" not in result:
        logger.warning(f"[ROUTER] LLM routing failed, fallback")
        return {
            "intent": "fallback",
            "confidence": 0.0,
            "required_tables": [],
            "is_lookup": False,
        }

    intent = result["intent"]
    confidence = float(result.get("confidence", 0.5))

    # Validate intent name
    if intent not in INTENT_TABLE_MAP:
        logger.warning(f"[ROUTER] Unknown intent '{intent}', fallback")
        return {
            "intent": "fallback",
            "confidence": 0.0,
            "required_tables": [],
            "is_lookup": False,
        }

    required_tables = INTENT_TABLE_MAP[intent]
    is_lookup = intent in (
        "portfolio_allocation_summary",
        "holding_loss_detail",
        "holding_profit_detail",
        "investment_change_summary",
        "investment_change_detail",
        "market_event_summary",
        "market_event_detail",
        "upcoming_schedule_summary",
        "upcoming_schedule_detail",
        "expert_movement_detail",
        "expert_type_detail",
        "news_signal_summary",
        "news_signal_detail",
    )

    logger.info(f"[ROUTER] intent={intent}, conf={confidence:.2f}, tables={len(required_tables)}")

    return {
        "intent": intent,
        "confidence": confidence,
        "required_tables": required_tables,
        "is_lookup": is_lookup,
    }
