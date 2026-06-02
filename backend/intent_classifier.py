"""
Intent Classifier — Phase 1
질문 + Genie SQL 기반으로 intent 분류.
Supported intents: portfolio_diagnosis, risk_alert, fallback
"""
import re
import logging

logger = logging.getLogger("intent_classifier")

# ============================================================
# 테이블명 → intent 매핑 (SQL 기반 분류, confidence 0.9)
# ============================================================
TABLE_INTENT_MAP = {
    "gd_serving_portfolio_diagnosis": "portfolio_diagnosis",
    "gd_llm_portfolio_context": "portfolio_diagnosis",
    "gd_llm_customer_context": "portfolio_diagnosis",
    "app_cache_portfolio_summary": "portfolio_diagnosis",
    "gd_customer_portfolio_signal": "risk_alert",
    "gd_pb_insight_card": "risk_alert",
    "app_cache_customer_alerts": "risk_alert",
    "app_cache_holding_signals": "risk_alert",
}

# ============================================================
# 키워드 → intent 매핑 (키워드 기반 분류, confidence 0.7~0.85)
# ============================================================
INTENT_KEYWORDS = {
    "portfolio_diagnosis": [
        "포트폴리오", "진단", "종합", "자산배분", "배분", "집중도",
        "분산", "전체", "현황", "상태", "점검", "분석해줘",
        "안정성", "유동성", "비중",
    ],
    "risk_alert": [
        "위험", "경고", "주의", "알림", "신호", "리스크",
        "위험한", "조심", "경계", "긴급",
    ],
}


def classify(question: str, sql: str | None = None, answer: str | None = None) -> dict:
    """
    Intent 분류 수행.
    
    Returns:
        {
            "intent": str,
            "confidence": float,
            "method": str,  # "table" | "keyword" | "fallback"
        }
    """
    # 1. SQL 테이블명 기반 분류 (최우선)
    if sql:
        result = _classify_by_table(sql)
        if result:
            logger.info(f"[INTENT] table-based: {result['intent']} (conf={result['confidence']})")
            return result

    # 2. 키워드 기반 분류
    result = _classify_by_keyword(question)
    if result:
        logger.info(f"[INTENT] keyword-based: {result['intent']} (conf={result['confidence']})")
        return result

    # 3. Fallback
    logger.info("[INTENT] fallback (no match)")
    return {"intent": "fallback", "confidence": 0.3, "method": "fallback"}


def _classify_by_table(sql: str) -> dict | None:
    """SQL에서 FROM/JOIN 절의 테이블명을 추출하여 intent 매핑."""
    sql_lower = sql.lower()
    for table_name, intent in TABLE_INTENT_MAP.items():
        if table_name in sql_lower:
            return {"intent": intent, "confidence": 0.9, "method": "table"}
    return None


def _classify_by_keyword(question: str) -> dict | None:
    """질문 키워드 매칭으로 intent 분류."""
    scores = []
    for intent, keywords in INTENT_KEYWORDS.items():
        matched = [kw for kw in keywords if kw in question]
        if matched:
            # 매칭 수에 따라 confidence 조정 (0.6 ~ 0.85)
            score = min(0.6 + len(matched) * 0.05, 0.85)
            scores.append({"intent": intent, "confidence": score, "method": "keyword"})

    if not scores:
        return None

    # 최고 점수 반환
    return max(scores, key=lambda x: x["confidence"])
