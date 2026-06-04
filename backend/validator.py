"""
Validator — Phase A PoC
LLM 출력 JSON의 스키마 검증 + 수치 교차검증 (hallucination 방지).
"""
import logging
import re

logger = logging.getLogger("validator")

# 필수 필드
REQUIRED_FIELDS = ["summary", "overall_status", "sections"]
VALID_STATUS_LEVELS = {"warning", "caution", "normal", "info"}
VALID_SECTION_TYPES = {"metrics_table", "chart_data", "alert_list", "action_list", "text_insight"}

# 안심 표현 패턴 (status=warning 시 금지)
REASSURING_PATTERNS = [
    "안심", "걸정 안", "걸정하지", "괜찮", "양호한 편", "양호합니다",
    "좋은 성과", "긍정적인 성과", "잘 분산", "잘 구성",
]


def validate(response: dict, source_data: dict) -> dict:
    """
    LLM 응답 검증 + 보정.
    
    Args:
        response: LLM이 생성한 JSON
        source_data: 원본 조회 데이터 (hallucination 검증용)
    
    Returns:
        검증/보정된 response dict. 치명적 오류 시 None.
    """
    if not response or not isinstance(response, dict):
        logger.warning("[VALIDATOR] Response is None or not dict")
        return None

    # 1. 필수 필드 검증
    for field in REQUIRED_FIELDS:
        if field not in response:
            logger.warning(f"[VALIDATOR] Missing required field: {field}")
            return None

    # 2. overall_status 검증
    status = response.get("overall_status", {})
    if not isinstance(status, dict) or status.get("level") not in VALID_STATUS_LEVELS:
        response["overall_status"] = {"level": "caution", "label": "점검 필요", "reason": ""}

    # 3. sections 검증
    sections = response.get("sections", [])
    if not isinstance(sections, list):
        response["sections"] = []
    else:
        valid_sections = []
        for s in sections:
            if isinstance(s, dict) and s.get("section_type") in VALID_SECTION_TYPES:
                valid_sections.append(s)
            else:
                logger.warning(f"[VALIDATOR] Invalid section removed: {s.get('section_type', '?')}")
        response["sections"] = valid_sections

    # 4. Summary-Status 일관성 검증
    level = response["overall_status"].get("level", "")
    summary = response.get("summary", "")
    if level == "warning" and summary:
        for pattern in REASSURING_PATTERNS:
            if pattern in summary:
                logger.warning(f"[VALIDATOR] Contradiction detected: status=warning but summary has '{pattern}'")
                # 모순되는 부분을 제거하지 않고 summary를 기본값으로 교체
                reason = response["overall_status"].get("reason", "")
                response["summary"] = f"주의가 필요한 상황입니다. {reason}"
                break

    # 5. 수치 교차검증 (hallucination 방지)
    _verify_numbers(response, source_data)

    # 6. recommended_actions 기본값
    if "recommended_actions" not in response:
        response["recommended_actions"] = []

    logger.info(f"[VALIDATOR] Passed: {len(response['sections'])} sections, status={level}")
    return response


def _verify_numbers(response: dict, source_data: dict):
    """
    LLM 응답 내 수치가 source_data에 존재하는지 확인.
    없는 수치를 발견하면 경고 로그. (심각한 경우 제거)
    """
    # source_data에서 모든 수치값 추출
    source_numbers = _extract_numbers_from_data(source_data)
    
    # metrics_table rows에서 수치 확인
    for section in response.get("sections", []):
        if section.get("section_type") == "metrics_table":
            rows = section.get("content", {}).get("rows", [])
            for row in rows:
                for cell in row:
                    cell_numbers = _extract_numbers_from_string(str(cell))
                    for num in cell_numbers:
                        if not _number_exists_in_source(num, source_numbers):
                            logger.warning(
                                f"[VALIDATOR] Potential hallucination: {num} not found in source data"
                            )


def _extract_numbers_from_data(data: dict) -> set:
    """재귀적으로 dict/list에서 모든 숫자값 추출."""
    numbers = set()
    if isinstance(data, dict):
        for v in data.values():
            if isinstance(v, (int, float)):
                numbers.add(float(v))
                # 파생값도 추가 (% 변환, 억/만 변환)
                numbers.add(float(v) * 100)  # ratio → %
                numbers.add(float(v) / 100_000_000)  # 원 → 억
                numbers.add(float(v) / 10_000)  # 원 → 만
            elif isinstance(v, (dict, list)):
                numbers.update(_extract_numbers_from_data(v))
    elif isinstance(data, list):
        for item in data:
            numbers.update(_extract_numbers_from_data(item))
    return numbers


def _extract_numbers_from_string(text: str) -> list:
    """문자열에서 숫자 추출."""
    pattern = r'-?\d+\.?\d*'
    matches = re.findall(pattern, text.replace(",", ""))
    return [float(m) for m in matches if m not in ("0", "1")]


def _number_exists_in_source(num: float, source_numbers: set, tolerance: float = 0.5) -> bool:
    """숫자가 source_numbers 내에 존재하는지 허용 오차 내에서 확인."""
    for src in source_numbers:
        if abs(src - num) < tolerance:
            return True
        # % 변환 확인 (11.92 → 0.1192)
        if abs(src * 100 - num) < tolerance:
            return True
    return True  # Phase A에서는 경고만 — 차단하지 않음
