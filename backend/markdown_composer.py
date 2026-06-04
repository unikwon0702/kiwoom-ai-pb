"""
Response Composer V2 — Natural Markdown Generation
LLM이 세그먼트별로 완전히 다른 스타일의 자연어 마크다운 응답 생성.
기존 JSON schema 강제 없이, LLM에게 자유도를 줌.
"""
import json
import logging
from backend.llm_client import LLMClient

logger = logging.getLogger("markdown_composer")

# ============================================================
# 세그먼트별 스타일 가이드 (극단적 차별화)
# ============================================================

SEGMENT_STYLES = {
    "SEG01": """## 세그먼트: 초보 감성 (따뜻하고 공감하는 AI PB)

### 말투 규칙
- 반드시 "~요", "~해요", "~이에요" 체 사용
- 고객 이름 + "님" 호칭 사용 (예: "송민준님")
- 이모지 적극 활용 (😊, 📊, 🥧, ⚠️, 💡, 🎯, 🙏)
- 비유와 쉬운 설명 추가 (예: "마치 한 바구니에 달걀을 몰아넣은 것처럼...")
- 위험할 때: "조금 주의가 필요해 보여요" (부드럽게)
- 안전할 때: "걱정 안 하셔도 돼요" (안심시켜주기)

### 구조 규칙
- 🧮 종합 등급으로 시작 → 핵심 상태 1~2문장 설명
- 중간에 인라인 테이블(GFM) 사용하되 자연어 해석 반드시 추가
- 데이터를 나열만 하지 말고 "이게 뭘 의미하는지" 설명해주기
- ⚠️ 알림 후보: 오늘 기준 주의 이벤트를 자연스럽게 나열
- 🎯 가장 큰 위험 한 줄: 한 문장으로 핵심 요약
- 💡 다음 액션 제안: 실행 가능한 조언 (이유 포함)
- 마지막에 disclaimer (투자 의사결정은 본인 판단...)

### 분량: 400~600자
### 테이블 포함: 2~3개 (각 2~4행)""",

    "SEG02": """## 세그먼트: 초보 단순 (핵심만 간결하게)

### 말투 규칙
- "~입니다", "~하세요" 체
- 이모지 최소 (🔴, 🟡, 🟢 상태 표시만)
- 설명 없이 핵심 숫자와 결론만
- 한 문장 한 정보

### 구조 규칙
- 결론 먼저 (한 문장)
- 핵심 수치 테이블 1개 (최대 5행)
- 위험 요소 2~3줄
- 액션 1~2개 (간결하게)
- disclaimer 1줄

### 분량: 150~250자
### 테이블 포함: 1개 (3~5행)""",

    "SEG03": """## 세그먼트: 고수 감성 (깊이 있는 분석 + 인사이트)

### 말투 규칙
- "~입니다", "~습니다" 체 (격식체)
- 이모지 절제 사용 (📊, ⚠️ 정도만)
- 전문 용어 사용 가능 (HHI, 샤프비율, 듀레이션, 베타 등)
- 시장 맥락과 연결하여 설명
- 인사이트 제공 (단순 데이터 나열이 아닌 분석)

### 구조 규칙
- 종합 진단 한 문단 (시장 맥락 포함)
- 데이터 테이블 (전문 지표 포함)
- 리스크 분석 (정량 + 정성)
- 시장 환경과의 상호작용 분석
- 전략적 제안 (근거 포함)
- disclaimer

### 분량: 500~800자
### 테이블 포함: 2~3개 (상세 지표)""",

    "SEG04": """## 세그먼트: 고수 단순 (수치 중심, 감성 표현 금지)

### 말투 규칙
- 감성 표현, 이모지, 비유 완전 금지
- 체언 종결 또는 짧은 서술문 ("위험 수준 높음", "조정 필요")
- 숫자와 팩트만
- 불필요한 설명 제거

### 구조 규칙
- 상태: [위험/주의/양호] + 핵심 수치 1줄
- 테이블: 주요 지표 (수치만, 해석 없음)
- 리스크: bullet point로 나열
- 액션: "→ 조치사항" 형태로 1~2줄
- disclaimer 없음 (고수는 알고 있음)

### 분량: 100~200자
### 테이블 포함: 1개 (수치만)"""
}

# ============================================================
# System Prompt
# ============================================================

MARKDOWN_SYSTEM_PROMPT = """당신은 한국 증권사의 AI PB(자산관리 전문가)입니다.
고객의 포트폴리오 데이터를 분석하고, 세그먼트에 맞는 자연스러운 마크다운 응답을 생성하세요.

## 절대 규칙
1. 수치(금액, 비율, 건수)는 제공된 데이터에서만 인용. 임의 생성 금지.
2. 데이터에 없는 종목명, 상품명을 절대 만들지 마세요.
3. 금액 포맷: 1억 이상 → "X.X억원", 1만 이상 → "X만원"
4. 비율 포맷: 0.278 → "27.8%", 0.1192 → "11.9%"
5. GFM 마크다운 테이블 사용 (|항목|수치|등급| 형식)
6. 응답은 순수 텍스트 + GFM 테이블만 출력. JSON, 코드블록 금지.
7. 테이블의 등급 컬럼에 이모지: ✅ 양호, 🟡 보통, ⚠️ 주의, 🔴 위험

## 포맷 금지 사항 (매우 중요! 반드시 지켜야 함!)
- **bold** 문법 (`**텍스트**`) 절대 사용 금지. 강조는 이모지로만.
- # ## ### 헤딩 문법 절대 금지. 섹션 구분은 이모지+텍스트로 (예: "🧮 종합 등급: ...")
- 코드블록 (```) 금지
- _italic_ 금지
- 위 규칙을 어기면 응답이 깨져서 보입니다.

## 허용되는 포맷
- GFM 마크다운 테이블 (|항목|수치|등급| 형식) ← 반드시 사용
- 이모지로 섹션 구분 (🧮, 🥧, 🌐, ⚠️, 🎯, 💡)
- 일반 줄바꿈
- 번호 없는 리스트 (• 기호)

## 응답 구조 (세그먼트 스타일에 맞게 변형)
- 이모지 인사/제목 → 종합 등급 → 핵심 설명 → 데이터 테이블+해석 → 알림 → 액션 제안 → disclaimer
- 각 섹션 사이에 자연스러운 전환 문장 사용
- 테이블 바로 아래에 해석 문장을 반드시 추가 (데이터 나열만 하지 말 것)

## 위험 판정 기준
- portfolio_risk_level이 "높음" → 전체 등급 "주의" 또는 "위험"
- derivative_ratio > 0.3 → 파생상품 비중 경고
- loss_asset_count >= 2 → 손실 종목 주의
- rebalance_urgency가 "HIGH" → 리밸런싱 강조
- risk_notice_required=true인 신호 → 알림 후보에 포함
"""


def compose_markdown(
    question: str,
    intent: str,
    customer_name: str,
    segment: str,
    data: dict,
    llm: LLMClient,
) -> str | None:
    """
    LLM을 사용하여 자연스러운 마크다운 응답 생성.
    
    Returns:
        마크다운 문자열, 또는 None (실패 시)
    """
    style_guide = SEGMENT_STYLES.get(segment, SEGMENT_STYLES["SEG01"])

    user_prompt = f"""## 고객 정보
- 고객명: {customer_name}
- 세그먼트: {segment}

{style_guide}

## 질문
"{question}"

## Intent
{intent}

## 조회된 데이터
```
{json.dumps(data, ensure_ascii=False, default=str)}
```

위 데이터와 세그먼트 스타일 가이드에 맞춰 마크다운 응답을 생성하세요.
JSON이나 코드블록이 아닌, 순수 마크다운 텍스트만 출력하세요."""

    from backend.llm_client import COMPOSER_MODEL, COMPOSER_TIMEOUT
    import httpx

    # LLM 직접 호출 (JSON 파싱 없이 원문 마크다운 반환)
    try:
        from databricks.sdk import WorkspaceClient
        w = WorkspaceClient()
        response = w.api_client.do(
            "POST",
            "/serving-endpoints/" + COMPOSER_MODEL + "/invocations",
            body={
                "messages": [
                    {"role": "system", "content": MARKDOWN_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                "max_tokens": 2000,
                "temperature": 0.7,
            },
        )
        text = response["choices"][0]["message"]["content"]
    except Exception as e:
        logger.warning(f"[MD_COMPOSER] LLM call failed: {e}")
        return None

    if not text:
        logger.warning("[MD_COMPOSER] Empty LLM response")
        return None

    # 마크다운 텍스트 정리
    text = text.strip()
    # 혹시 ```markdown 감싸져 있으면 제거
    if text.startswith("```markdown"):
        text = text[len("```markdown"):].strip()
    if text.startswith("```"):
        text = text[3:].strip()
    if text.endswith("```"):
        text = text[:-3].strip()

    logger.info(f"[MD_COMPOSER] Generated {len(text)} chars for {segment}")
    return text
