"""
Response Composer — Phase A PoC
LLM이 데이터 + 세그먼트 정보를 받아 structured JSON 생성.
Genie Space를 대체하는 핵심 모듈.
"""
import json
import logging
from backend.llm_client import LLMClient

logger = logging.getLogger("response_composer")

# ============================================================
# Segment Guidelines (기존 genie_client.py에서 이전)
# ============================================================

SEGMENT_TONE = {
    "SEG01": "따뜻하고 공감하는 톤. '안심하셔도 돼요' 같은 표현은 status가 normal/info일 때만 사용. '~이에요', '~해요' 체. 위험 상태일 때는 '조금 주의가 필요해 보여요' 식으로 부드럽게 전달.",
    "SEG02": "명확하고 초간결한 톤. 핵심만. 3문장 이내. '점검 필요', '조정 필요' 식 직설적 표현.",
    "SEG03": "깊이 있는 분석+인사이트. 시장 맥락 설명. '~입니다' 체. 전문 용어 사용 가능.",
    "SEG04": "수치 중심 간결체. 결론 먼저. '~입니다', '~하세요' 체. 감성 표현 금지.",
}

SEGMENT_DISCLAIMER = {
    "SEG01": "투자 의사결정은 본인의 판단과 책임 하에 이루어져요. 걱정되시면 담당 PB님과 상담해보세요.",
    "SEG02": "",
    "SEG03": "최종 판단은 본인 책임 하에 이루어집니다.",
    "SEG04": "본인 판단 하에 실행.",
}

# ============================================================
# System Prompt
# ============================================================

COMPOSER_SYSTEM_PROMPT = """당신은 한국 증권사의 AI PB(자산관리 전문가)입니다.
고객의 질문과 조회된 데이터를 기반으로 structured JSON 응답을 생성하세요.

## 절대 규칙
1. 수치(금액, 비율, 건수)는 제공된 데이터에서만 인용하세요. 임의 생성 금지.
2. overall_status.level이 "warning"이면 summary에 "안심", "걸정 안", "괜찮" 같은 안심 표현을 절대 사용하지 마세요.
3. overall_status.level이 "normal"이면 "위험", "주의" 같은 경고 표현을 사용하지 마세요.
4. 데이터에 없는 종목명, 상품명을 생성하지 마세요.
5. 반드시 valid JSON만 출력하세요. 설명 텍스트 추가 금지.

## JSON Schema
```json
{
  "summary": "세그먼트 톤에 맞는 1~2문장 요약",
  "overall_status": {
    "level": "warning|caution|normal|info",
    "label": "한글 라벨 (2~4자)",
    "reason": "근거 설명"
  },
  "sections": [
    {
      "section_type": "metrics_table|chart_data|alert_list|action_list|text_insight",
      "title": "섬션 제목",
      "icon": "이모지",
      "content": {}
    }
  ],
  "recommended_actions": [
    {"priority": 1, "action": "액션 내용 (번호/기호 없이 문장만)", "reason": "근거", "urgency": "high|medium|low"}
  ],
  "disclaimer": ""
}
```

## Section content 형식
- metrics_table: {"headers": ["항목", "수치", "등급"], "rows": [["항목명", "포맷된 값", "태그"]...]}
  - 금액: 1억 이상 → "X.X억원", 1만 이상 → "X만원"
  - 비율: 0~1 → "XX.X%"
  - 등급 태그: "🟢 수익", "🔴 위험", "🟠 주의", "🟢 양호", "🟢 낮음" 등
- chart_data: {"chart_type": "donut", "data": [{"name": "라벨", "value": 숫자(%)}]}
- alert_list: {"items": [{"level": "warning|caution", "title": "종목명 — 신호명", "detail": "설명"}]}
- action_list: {"items": [{"priority": 1, "action": "...", "reason": "...", "urgency": "high|medium|low"}]}
  - action 텍스트에 ①②③ 같은 번호나 기호를 넣지 마세요. priority 필드가 순서를 나타냅니다.
- text_insight: {"text": "인사이트 텍스트", "highlights": ["강조 키워드"]}
"""


# ============================================================
# Compose Function
# ============================================================

def compose(
    question: str,
    intent: str,
    customer_name: str,
    segment: str,
    data: dict,
    llm: LLMClient,
) -> dict | None:
    """
    LLM을 사용하여 구조화 JSON 응답 생성.
    
    Args:
        question: 사용자 질문
        intent: 분류된 intent
        customer_name: 고객명
        segment: 세그먼트 코드 (SEG01~04)
        data: 조회된 데이터 dict (diagnosis, signals, insight_cards, rebalancing 등)
        llm: LLMClient 인스턴스
    
    Returns:
        structured JSON dict, 또는 None (LLM 실패 시)
    """
    tone = SEGMENT_TONE.get(segment, SEGMENT_TONE["SEG01"])
    disclaimer = SEGMENT_DISCLAIMER.get(segment, "")

    user_prompt = f"""## 고객 정보
- 고객명: {customer_name}
- 세그먼트: {segment}
- 톤: {tone}

## 질문
"{question}"

## Intent
{intent}

## 조회된 데이터
```json
{json.dumps(data, ensure_ascii=False, default=str)}
```

## 추가 지시사항
- disclaimer: "{disclaimer}"
- summary는 세그먼트 톤에 맞게 작성하되, overall_status와 일관되게 작성하세요.
- metrics_table의 rows는 최대 6행. 핵심 지표만 선별.
- **chart_data 필수**: diagnosis 데이터에 ratio 필드(stock_ratio, bond_ratio, etf_ratio, derivative_ratio, cash_ratio, fund_ratio 등)가 있으면 반드시 chart_data section을 생성하세요. chart_type="donut", data=[{{"name": "주식", "value": 27.8}}, ...]. 0%인 항목은 제외. 값은 %단위.
- alert_list는 risk_notice_required=true인 신호 우선. 최대 5개.
- recommended_actions는 rebalancing 데이터 기반. 없으면 빈 배열.

## 필수 sections 순서 (portfolio_diagnosis)
1. metrics_table (핵심 진단 지표)
2. chart_data (자산군 비중 도넛 차트) ← 반드시 포함!
3. alert_list (주의 신호)
4. text_insight (종합 해석)

위 데이터만 사용하여 JSON을 생성하세요."""

    result = llm.compose_response(
        system_prompt=COMPOSER_SYSTEM_PROMPT,
        user_prompt=user_prompt,
    )

    if not result:
        logger.warning("[COMPOSER] LLM composition failed")
        return None

    # 기본 필드 보정
    if "sections" not in result:
        result["sections"] = []
    if "recommended_actions" not in result:
        result["recommended_actions"] = []
    if "disclaimer" not in result:
        result["disclaimer"] = disclaimer

    logger.info(f"[COMPOSER] Generated {len(result.get('sections', []))} sections")
    return result
