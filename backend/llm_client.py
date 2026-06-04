"""
LLM Client — Phase A PoC
Databricks Foundation Model API 호출 래퍼.
Intent Router(경량) + Response Composer(메인) 두 가지 용도.
"""
import json
import logging
import os
import time
from databricks.sdk import WorkspaceClient

logger = logging.getLogger("llm_client")

# 모델 설정
ROUTER_MODEL = os.environ.get("LLM_ROUTER_MODEL", "databricks-gpt-5-4-mini")
COMPOSER_MODEL = os.environ.get("LLM_COMPOSER_MODEL", "databricks-gpt-5-4-mini")
ROUTER_TIMEOUT = 5.0   # 초
COMPOSER_TIMEOUT = 15.0  # 초


class LLMClient:
    """Databricks FM API 호출 클래스."""

    def __init__(self):
        self.w = WorkspaceClient()

    def route_intent(
        self, question: str, system_prompt: str, max_tokens: int = 200
    ) -> dict | None:
        """
        Intent Router: 질문을 분류하여 intent + required_tables 반환.
        경량 모델 사용, timeout 5초.
        """
        return self._call(
            model=ROUTER_MODEL,
            system_prompt=system_prompt,
            user_prompt=question,
            max_tokens=max_tokens,
            temperature=0.0,
            timeout=ROUTER_TIMEOUT,
            parse_json=True,
        )

    def compose_response(
        self, system_prompt: str, user_prompt: str, max_tokens: int = 2000
    ) -> dict | None:
        """
        Response Composer: 데이터 + 세그먼트 정보를 받아 structured JSON 생성.
        메인 모델 사용, timeout 15초.
        """
        return self._call(
            model=COMPOSER_MODEL,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=max_tokens,
            temperature=0.1,
            timeout=COMPOSER_TIMEOUT,
            parse_json=True,
        )

    def _call(
        self,
        model: str,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int,
        temperature: float,
        timeout: float,
        parse_json: bool = False,
    ) -> dict | str | None:
        """
        FM API 호출 공통 로직.
        parse_json=True 시 JSON 파싱 시도, 실패 시 None.
        """
        start = time.time()
        try:
            resp = self.w.api_client.do(
                "POST",
                f"/serving-endpoints/{model}/invocations",
                body={
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )
            elapsed = time.time() - start

            if elapsed > timeout:
                logger.warning(f"[LLM] {model} exceeded timeout ({elapsed:.2f}s > {timeout}s)")
                return None

            content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage = resp.get("usage", {})
            logger.info(
                f"[LLM] {model}: {elapsed:.2f}s, "
                f"tokens={usage.get('total_tokens', '?')}"
            )

            if not parse_json:
                return content

            # JSON 파싱 (코드 펜스 제거)
            return self._parse_json(content)

        except Exception as e:
            elapsed = time.time() - start
            logger.error(f"[LLM] {model} failed ({elapsed:.2f}s): {e}")
            return None

    @staticmethod
    def _parse_json(text: str) -> dict | None:
        """
        LLM 출력에서 JSON 추출.
        markdown code fence, 여분의 텍스트 제거.
        """
        if not text:
            return None

        clean = text.strip()

        # ```json ... ``` 제거
        if clean.startswith("```"):
            # 첫줄 제거
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
            # 마지막 ``` 제거
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()

        # JSON 객체 추출 (첫 { ~ 마지막 })
        start_idx = clean.find("{")
        end_idx = clean.rfind("}")
        if start_idx == -1 or end_idx == -1:
            return None

        json_str = clean[start_idx : end_idx + 1]
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            logger.warning(f"[LLM] JSON parse failed: {json_str[:200]}...")
            return None
