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
    "market_context_analysis": [],
    "general_financial_qna": [],
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
- market_context_analysis: 시장 상황, 금리, 환율, 전망
- general_financial_qna: 금융 용어, 개념 설명 (MDD, 샤프비율 등)
- fallback: 위 어느 것에도 해당하지 않는 질문

## Rules
- "자산 비중", "평가금액 합계", "구성 확인" → portfolio_allocation_summary
- "손실", "마이너스", "떨어진" → holding_loss_detail
- "수익", "플러스", "올라간" → holding_profit_detail
- "매도", "리밸런싱", "비중 조정" → rebalancing_recommendation
- "위험", "알림", "주의" → risk_alert
- "진단", "분석", "종합" → portfolio_diagnosis
- 조회형 질문(확인, 보여줘, 얼마) vs 분석형 질문(진단, 분석) 구분 중요
- "자산 유형별 비중과 평가금액 합계 확인" → portfolio_allocation_summary (NOT portfolio_diagnosis)
- "손실 중인 종목 세부 현황" → holding_loss_detail (NOT portfolio_allocation_summary)
"""


# ============================================================
# Router Function
# ============================================================

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
    )

    logger.info(f"[ROUTER] intent={intent}, conf={confidence:.2f}, tables={len(required_tables)}")

    return {
        "intent": intent,
        "confidence": confidence,
        "required_tables": required_tables,
        "is_lookup": is_lookup,
    }
