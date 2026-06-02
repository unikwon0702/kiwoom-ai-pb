"""
Genie Space 대화 API 클라이언트.
AI_PB-Simulation_Test_V4(UPDATE) Space에 질문 전송.
세그먼트별 고객 프로필을 기반으로 맞춤 응답을 생성.
"""
from databricks.sdk import WorkspaceClient
import time
import os
import re
import logging

logger = logging.getLogger("genie_client")
logger.setLevel(logging.DEBUG)

# ===== 세그먼트별 응답 가이드라인 (강화버전 - Genie가 반드시 따르도록 구체적 지시) =====
SEGMENT_GUIDELINES = {
    "SEG01": {  # 초보 감성
        "label": "초보 감성",
        "tone": "공감적이고 따뜻한 톤. 비유와 예시를 활용하여 쉽게 설명. '~이에요', '~할 수 있어요' 체를 사용.",
        "risk_guidance": "리스크를 부드럽게 전달. '마치 ~처럼'이라는 비유를 반드시 1개 이상 사용. 안심할 수 있는 포인트를 먼저 강조.",
        "recommendation_style": "'안심할 수 있는 점은~'으로 시작하는 문장을 반드시 포함. 왜 이 방향이 좋은지 감성적으로 설명.",
        "structure": "핵심 요약 → '안심 포인트' 제시 → 비유를 활용한 설명 → 부드러운 다음 행동 제안",
        "avoid": "전문 용어(MDD, 샤프비율 등), 숫자 테이블, 차가운 경고, 임계값 언급",
    },
    "SEG02": {  # 초보 단순
        "label": "초보 단순",
        "tone": "명확하고 초간결한 톤. 핵심만. 전문용어 금지. 답변 전체 5문장 이내.",
        "risk_guidance": "위험/안전을 ◯/✕로 구분. '해야 할 것'과 '하지 말아야 할 것'을 불릿 리스트로 제시.",
        "recommendation_style": "결론 1문장 먼저. 행동 지침을 '- 해야 할 것:', '- 하지 말아야 할 것:' 형태로.",
        "structure": "결론(1문장) → 핵심 수치(2~3개) → 해야 할 행동 → 주의사항",
        "avoid": "긴 설명, 여러 옵션 제시, 감성적 표현, 비유, 조건부 문장, 테이블",
    },
    "SEG03": {  # 고수 감성
        "label": "고수 감성",
        "tone": "깊이 있는 분석 + 인사이트. 시장 맥락과 스토리를 함께 제공. '~입니다' 체 사용.",
        "risk_guidance": "리스크를 시장 맥락에서 해석. 시나리오별 영향도 분석. 전문 지표(변동성, 듀레이션 등) 적극 활용.",
        "recommendation_style": "복수 전략 옵션을 '시나리오 A/B' 형태로 제시. 각 장단점과 시장 조건을 연결.",
        "structure": "시장 맥락 → 깊이 있는 진단 → 시나리오별 전략 → 핵심 인사이트 → 모니터링 포인트",
        "avoid": "지나치게 단순화, 초보자용 설명, 결론만 제시하고 근거 누락, ◯/✕ 형식",
    },
    "SEG04": {  # 고수 단순
        "label": "고수 단순",
        "tone": "수치 중심 간결체. 결론 먼저. '~입니다', '~하세요' 체 사용. 감성 표현 금지.",
        "risk_guidance": "핵심 리스크 지표를 반드시 마크다운 테이블(|...|)로 제시. 임계값 기준 판단을 포함.",
        "recommendation_style": "'~% 이상이면 ~하세요' 형태의 액션 아이템을 반드시 3개 이상 제시.",
        "structure": "결론(수치 1문장) → 핵심 지표 테이블(마크다운) → 임계값 기준 판단 → 액션 아이템 리스트",
        "avoid": "비유, '마치', '처럼', 감성적 표현, '안심', '걱정', 긴 배경 설명, 물음표로 끝나는 제안",
    },
}


class GenieChatClient:
    def __init__(self, space_id: str = None, timeout: int = 60):
        self.w = WorkspaceClient()
        self.space_id = space_id or os.environ.get("GENIE_SPACE_ID")
        self.timeout = timeout

    def ask(self, question: str, conversation_id: str = None,
            customer_id: str = None, customer_name: str = None,
            segment: str = None) -> dict:
        """Genie Space에 질문 전송. segment를 기반으로 맞춤 프롬프트 생성."""
        enriched = self._inject_context(question, customer_id, customer_name, segment)

        # 디버깅 로그
        logger.info(f"[GENIE_REQUEST] customer_id={customer_id}, segment={segment}, question={question[:50]}")
        logger.debug(f"[GENIE_PAYLOAD] enriched_prompt={enriched[:300]}...")

        conv_id = conversation_id
        if not conv_id:
            resp = self.w.api_client.do(
                'POST',
                f'/api/2.0/genie/spaces/{self.space_id}/start-conversation',
                body={'content': enriched}
            )
            conv_id = resp.get('conversation_id') or resp.get('id')
            mid = resp.get('message_id')
            if mid:
                return self._poll(conv_id, mid)

        try:
            msg_resp = self.w.api_client.do(
                'POST',
                f'/api/2.0/genie/spaces/{self.space_id}/conversations/{conv_id}/messages',
                body={'content': enriched}
            )
        except Exception as e:
            if '404' in str(e) or 'not found' in str(e).lower():
                resp = self.w.api_client.do(
                    'POST',
                    f'/api/2.0/genie/spaces/{self.space_id}/start-conversation',
                    body={'content': enriched}
                )
                conv_id = resp.get('conversation_id') or resp.get('id')
                mid = resp.get('message_id')
                if mid:
                    return self._poll(conv_id, mid)
                msg_resp = self.w.api_client.do(
                    'POST',
                    f'/api/2.0/genie/spaces/{self.space_id}/conversations/{conv_id}/messages',
                    body={'content': enriched}
                )
            else:
                return {"status": "error", "answer": str(e), "sql": None, "table_data": None, "conversation_id": conv_id}

        mid = msg_resp.get('message_id') or msg_resp.get('id')
        return self._poll(conv_id, mid)

    def _inject_context(self, question, customer_id, customer_name, segment=None):
        """고객 세그먼트 프로필 + 응답 가이드라인을 포함한 컨텍스트 주입."""
        if not customer_id:
            return question

        display_name = customer_name or customer_id
        guide = SEGMENT_GUIDELINES.get(segment, {})

        if not guide:
            # segment 매핑 실패 시 기본 동작 (기존과 유사)
            logger.warning(f"[GENIE] Unknown segment '{segment}' for {customer_id}. Falling back to basic context.")
            return (
                f"{display_name}님의 {question}\n\n"
                f"---\n"
                f"SQL 필터: customer_id = '{customer_id}' (답변에 customer_id 값을 노출하지 마세요)"
            )

        # 세그먼트별 풍부한 컨텍스트 구성
        context = (
            f"[고객 프로필]\n"
            f"- 고객명: {display_name}\n"
            f"- 세그먼트: {guide['label']} ({segment})\n"
            f"- SQL 필터 조건: customer_id = '{customer_id}'\n\n"
            f"[응답 가이드라인 — 이 고객 세그먼트에 맞게 반드시 적용]\n"
            f"- 톤앤매너: {guide['tone']}\n"
            f"- 리스크 전달 방식: {guide['risk_guidance']}\n"
            f"- 추천/제안 방식: {guide['recommendation_style']}\n"
            f"- 답변 구조: {guide['structure']}\n"
            f"- 금지사항: {guide['avoid']}\n\n"
            f"[규칙]\n"
            f"- 답변에 customer_id 값(CUST0010 등)을 절대 노출하지 마세요.\n"
            f"- '{display_name}님'으로만 지칭하세요.\n"
            f"- 내부 테이블명, 스키마명을 노출하지 마세요.\n\n"
            f"사용자 질문: {question}"
        )
        return context

    def _poll(self, conv_id, message_id):
        start = time.time()
        while time.time() - start < self.timeout:
            result = self.w.api_client.do(
                'GET',
                f'/api/2.0/genie/spaces/{self.space_id}/conversations/{conv_id}/messages/{message_id}'
            )
            status = result.get('status', '')
            if status in ('COMPLETED', 'completed'):
                return self._parse(result, conv_id)
            if status in ('FAILED', 'failed'):
                return {"status": "error", "answer": result.get('error', {}).get('message', '응답 생성 실패'), "sql": None, "table_data": None, "conversation_id": conv_id}
            time.sleep(2)
        return {"status": "timeout", "answer": "응답 시간 초과 (60초)", "sql": None, "table_data": None, "conversation_id": conv_id}

    def _parse(self, response, conv_id):
        answer = ''
        sql = None
        table_data = None
        statement_id = None
        suggested_questions = []

        for att in response.get('attachments', []):
            # SQL query + statement_id
            if 'query' in att:
                q = att['query']
                sql = q.get('query', q.get('sql', ''))
                statement_id = q.get('statement_id')
            # Text answer
            elif 'text' in att:
                text = att.get('text', {}).get('content', '')
                if text:
                    answer = text
            # Suggested follow-up questions
            elif 'suggested_questions' in att:
                sq = att['suggested_questions']
                suggested_questions = sq.get('questions', [])

        # Also check top-level query_result for statement_id
        qr = response.get('query_result', {})
        if not statement_id and qr.get('statement_id'):
            statement_id = qr['statement_id']

        # Fetch actual table data via SQL Statements API
        if statement_id:
            table_data = self._fetch_statement_result(statement_id)

        if not answer:
            answer = response.get('content', '')

        # 후처리: customer_id 노출 방지 + 내부 스키마 필터링
        answer = self._strip_customer_id(answer)
        suggested_questions = [self._strip_customer_id(q) for q in suggested_questions]
        suggested_questions = [q for q in suggested_questions if not self._has_internal_schema(q)]

        return {
            "status": "success",
            "answer": answer,
            "sql": sql,
            "table_data": table_data,
            "conversation_id": conv_id,
            "suggested_questions": suggested_questions[:3] if suggested_questions else []
        }

    def _strip_customer_id(self, text: str) -> str:
        """답변/팔로업에서 customer_id 패턴을 제거합니다."""
        if not text:
            return text
        text = re.sub(r'\s*\((?:customer_id:\s*)?CUST\d+\)', '', text)
        text = re.sub(r'\bCUST\d+\b', '', text)
        text = re.sub(r'  +', ' ', text).strip()
        return text

    def _has_internal_schema(self, text: str) -> bool:
        """텍스트에 내부 테이블명/스키마 정보가 포함되어 있는지 확인합니다."""
        if not text:
            return False
        patterns = [
            r'\bgd_\w+',           # gd_customer_interest_serving 등
            r'\bapp_cache_\w+',    # app_cache_holding_signals 등
            r'\b\w+_serving\b',    # ~_serving 테이블
            r'\b\w+_context\b',    # ~_context 테이블
            r'\bdev\.ai_pb_\w+',   # dev.ai_pb_gold.~ 등
            r'\b\w+_gold\.\w+',    # ~_gold.gd_~ 등
            r'\bSELECT\b',         # SQL 구문 직접 노출
            r'\bFROM\s+\w+\.\w+',  # FROM schema.table 패턴
            r'\b테이블\b',         # "테이블" 단어 직접 노출
            r'\b칸럼\b',           # "칸럼" 단어 직접 노출
        ]
        for p in patterns:
            if re.search(p, text, re.IGNORECASE):
                return True
        return False

    def _fetch_statement_result(self, statement_id: str) -> dict | None:
        """SQL Statements API에서 쿼리 결과 데이터를 가져옵니다."""
        try:
            stmt = self.w.api_client.do(
                'GET',
                f'/api/2.0/sql/statements/{statement_id}'
            )
            manifest = stmt.get('manifest', {})
            result = stmt.get('result', {})

            columns = [col.get('name', '') for col in manifest.get('schema', {}).get('columns', [])]
            rows = result.get('data_array', [])

            if columns and rows:
                return {"columns": columns, "rows": rows}
        except Exception:
            pass
        return None
