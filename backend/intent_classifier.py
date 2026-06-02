"""
Intent Classifier v2
질문 + Genie SQL 기반으로 intent 분류.

지원 Intent:
  - portfolio_allocation_summary: 자산 구성/비중/합계 단순 조회
  - portfolio_diagnosis: 포트폴리오 건강도 진단 (리스크 + 액션)
  - rebalancing_recommendation: 비중 조정 추천
  - holding_risk_check: 보유 종목 위험도 점검
  - risk_alert: 위험 신호/알림
  - fallback: 분류 실패 → 기존 Genie 응답

분류 우선순위:
  1. 조회형 패턴 감지 (confidence 0.92) — 단순 조회 의도 우선
  2. SQL 테이블명 (confidence 0.85~0.9)
  3. 키워드 매칭 (confidence 0.6~0.85)
  4. Fallback (confidence 0.3)
"""
import re
import logging

logger = logging.getLogger("intent_classifier")

# ============================================================
# 조회형 패턴 감지 (최우선)
# 이 패턴에 매칭되면 단순 조회 Intent로 분류 (진단/액션 생성 안 함)
# ============================================================

# 조회 의도 신호 키워드 (정보 요청에 사용되는 동사/어미)
LOOKUP_SIGNAL_KEYWORDS = [
    "보여줘", "알려줘", "확인해줘", "확인해봐", "확인해줄래",
    "알려줘", "알려줘라", "알려줘요",
    "얼마나", "몇 개", "몇개", "합계",
    "얼마야", "얼마인지", "얼마인가",
]

# 조회 대상 키워드 (자산 구성/구조 정보)
LOOKUP_TARGET_KEYWORDS = [
    "비중", "구성", "분포", "배분", "현황",
    "평가금액", "수익률", "수익", "손실",
    "자산 유형", "자산유형", "섹터별", "종목별",
    "유형별", "합계", "총액",
    "보유 종목", "보유종목",
]

# 진단/분석/액션 의도 신호 (이것이 있으면 조회형이 아님)
DIAGNOSIS_SIGNAL_KEYWORDS = [
    "진단", "분석", "위험도", "건강도", "위험한가",
    "리스크", "위험", "안전한가", "괜찮은가",
    "문제", "어떡", "어때",
    "위험한", "위험해", "손절", "줄여야", "줄이", "줄여",
    "리밸런싱", "조절", "매도", "축소",
]


# ============================================================
# 테이블명 → intent 매핑 (SQL 기반)
# ============================================================
TABLE_INTENT_MAP = {
    # 조회형 (조회 패턴과 결합해서 판단)
    "gd_serving_portfolio_diagnosis": "portfolio_diagnosis",
    "gd_llm_portfolio_context": "portfolio_diagnosis",
    "gd_llm_customer_context": "portfolio_diagnosis",
    "app_cache_portfolio_summary": "portfolio_diagnosis",
    # 리밸런싱
    "gd_serving_rebalancing_action": "rebalancing_recommendation",
    # 리스크/신호
    "gd_customer_portfolio_signal": "risk_alert",
    "gd_pb_insight_card": "risk_alert",
    "app_cache_customer_alerts": "risk_alert",
    "app_cache_holding_signals": "risk_alert",
}

# ============================================================
# 키워드 → intent 매핑
# ============================================================
INTENT_KEYWORDS = {
    "portfolio_allocation_summary": [
        "비중", "구성", "분포", "현황", "평가금액",
        "자산 유형", "자산유형", "섹터별", "유형별",
        "합계", "총액", "종목별", "보유 종목",
        "수익률", "수익", "손실",
    ],
    "portfolio_diagnosis": [
        "진단", "분석", "종합 진단", "종합분석",
        "건강도", "점검", "안정성",
        "집중도 위험", "분산 부족",
        "위험한가", "안전한가", "괜찮은가",
        "포트폴리오 위험", "포트폴리오 분석",
    ],
    "rebalancing_recommendation": [
        "리밸런싱", "비중 조절", "비중 줄여", "비중 늘려",
        "매도 후보", "매도해야", "줄여야",
        "축소", "확대", "조정",
    ],
    "holding_risk_check": [
        "위험한 종목", "위험 종목", "손절", "손절해야",
        "보유 종목 위험", "종목 위험도",
        "종목 위험",
    ],
    "risk_alert": [
        "경고", "주의", "알림", "신호",
        "리스크", "경계", "긴급",
        "위험 신호", "리스크 신호",
        "위험한 거", "위험해",
    ],
}


def classify(question: str, sql: str | None = None, answer: str | None = None) -> dict:
    """
    Intent 분류 수행.
    
    분류 우선순위:
      1. 조회형 패턴 감지 (단순 조회 의도 → portfolio_allocation_summary)
      2. SQL 테이블명 기반 분류
      3. 키워드 기반 분류
      4. Fallback
    
    Returns:
        {
            "intent": str,
            "confidence": float,
            "method": str,  # "lookup_pattern" | "table" | "keyword" | "fallback"
        }
    """
    # 1. 조회형 패턴 감지 (최우선 — 단순 조회 의도)
    result = _classify_lookup_pattern(question)
    if result:
        logger.info(f"[INTENT] lookup-pattern: {result['intent']} (conf={result['confidence']})")
        return result

    # 2. SQL 테이블명 기반 분류
    if sql:
        result = _classify_by_table(sql, question)
        if result:
            logger.info(f"[INTENT] table-based: {result['intent']} (conf={result['confidence']})")
            return result

    # 3. 키워드 기반 분류
    result = _classify_by_keyword(question)
    if result:
        logger.info(f"[INTENT] keyword-based: {result['intent']} (conf={result['confidence']})")
        return result

    # 4. Fallback
    logger.info("[INTENT] fallback (no match)")
    return {"intent": "fallback", "confidence": 0.3, "method": "fallback"}


def _classify_lookup_pattern(question: str) -> dict | None:
    """
    조회형 패턴 감지.
    조건: 조회 대상 키워드가 있고 + 진단 신호가 없을 때
    → portfolio_allocation_summary
    """
    has_lookup_target = any(kw in question for kw in LOOKUP_TARGET_KEYWORDS)
    has_diagnosis_signal = any(kw in question for kw in DIAGNOSIS_SIGNAL_KEYWORDS)
    has_lookup_signal = any(kw in question for kw in LOOKUP_SIGNAL_KEYWORDS)

    # 조회 대상이 있고 + 진단 신호가 없으면 → 단순 조회
    if has_lookup_target and not has_diagnosis_signal:
        confidence = 0.88
        if has_lookup_signal:
            confidence = 0.92  # "보여줘", "확인해줘" 등 명시적 조회 요청
        return {"intent": "portfolio_allocation_summary", "confidence": confidence, "method": "lookup_pattern"}

    return None


def _classify_by_table(sql: str, question: str) -> dict | None:
    """SQL에서 FROM/JOIN 절의 테이블명을 추출하여 intent 매핑."""
    sql_lower = sql.lower()
    matched_intent = None
    for table_name, intent in TABLE_INTENT_MAP.items():
        if table_name in sql_lower:
            matched_intent = intent
            break

    if not matched_intent:
        return None

    # 테이블이 portfolio_diagnosis로 매핑되더라도,
    # 질문이 조회형이면 allocation_summary로 재분류
    if matched_intent == "portfolio_diagnosis":
        has_lookup_target = any(kw in question for kw in LOOKUP_TARGET_KEYWORDS)
        has_diagnosis_signal = any(kw in question for kw in DIAGNOSIS_SIGNAL_KEYWORDS)
        if has_lookup_target and not has_diagnosis_signal:
            return {"intent": "portfolio_allocation_summary", "confidence": 0.88, "method": "table+lookup"}

    return {"intent": matched_intent, "confidence": 0.9, "method": "table"}


# Intent 우선순위 (동점 시 더 구체적인 intent가 이김)
# 숫자가 클수록 우선
INTENT_PRIORITY = {
    "holding_risk_check": 5,
    "rebalancing_recommendation": 4,
    "risk_alert": 3,
    "portfolio_diagnosis": 2,
    "portfolio_allocation_summary": 1,  # 가장 더 범용적
}


def _classify_by_keyword(question: str) -> dict | None:
    """질문 키워드 매칭으로 intent 분류. 동점 시 더 구체적인 intent 우선."""
    scores = []
    for intent, keywords in INTENT_KEYWORDS.items():
        matched = [kw for kw in keywords if kw in question]
        if matched:
            # 매칭 수에 따라 confidence 조정 (0.6 ~ 0.85)
            score = min(0.6 + len(matched) * 0.05, 0.85)
            scores.append({"intent": intent, "confidence": score, "method": "keyword"})

    if not scores:
        return None

    # 동점 시 우선순위로 결정 (더 구체적인 intent 우선)
    return max(scores, key=lambda x: (x["confidence"], INTENT_PRIORITY.get(x["intent"], 0)))
