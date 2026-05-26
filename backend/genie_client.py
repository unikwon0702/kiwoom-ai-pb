"""
Genie Space 대화 API 클라이언트.
AI_PB-Simulation_Test_V4(UPDATE) Space에 질문 전송 → LLM Gold 테이블 기반 응답.
"""
from databricks.sdk import WorkspaceClient
import time
import os


class GenieChatClient:
    def __init__(self, space_id: str = None, timeout: int = 60):
        self.w = WorkspaceClient()
        self.space_id = space_id or os.environ.get("GENIE_SPACE_ID")
        self.timeout = timeout

    def ask(self, question: str, conversation_id: str = None) -> dict:
        """
        Genie Space에 질문 전송 → 응답 반환.

        Returns:
            {
                "status": "success" | "error" | "timeout",
                "answer": str,
                "sql": str | None,
                "conversation_id": str
            }
        """
        # 1. 대화 세션 확보
        conv_id = conversation_id
        if not conv_id:
            resp = self.w.api_client.do(
                'POST',
                f'/api/2.0/genie/spaces/{self.space_id}/start-conversation',
                body={}
            )
            conv_id = resp.get('conversation_id') or resp.get('id')

        # 2. 메시지 전송
        try:
            msg_resp = self.w.api_client.do(
                'POST',
                f'/api/2.0/genie/spaces/{self.space_id}/conversations/{conv_id}/messages',
                body={'content': question}
            )
        except Exception as e:
            if '404' in str(e) or 'not found' in str(e).lower():
                # 세션 만료 → 재시작
                resp = self.w.api_client.do(
                    'POST',
                    f'/api/2.0/genie/spaces/{self.space_id}/start-conversation',
                    body={}
                )
                conv_id = resp.get('conversation_id') or resp.get('id')
                msg_resp = self.w.api_client.do(
                    'POST',
                    f'/api/2.0/genie/spaces/{self.space_id}/conversations/{conv_id}/messages',
                    body={'content': question}
                )
            else:
                return {
                    "status": "error",
                    "answer": str(e),
                    "sql": None,
                    "conversation_id": conv_id
                }

        message_id = msg_resp.get('message_id') or msg_resp.get('id')

        # 3. 폴링 대기
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
                return {
                    "status": "error",
                    "answer": result.get('error', {}).get('message', '응답 생성 실패'),
                    "sql": None,
                    "conversation_id": conv_id
                }
            time.sleep(2)

        return {
            "status": "timeout",
            "answer": "응답 시간 초과 (60초)",
            "sql": None,
            "conversation_id": conv_id
        }

    def _parse(self, response: dict, conv_id: str) -> dict:
        """응답 파싱."""
        answer = response.get('content', '')
        sql = None

        for att in response.get('attachments', []):
            if att.get('type') == 'QUERY' or 'query' in att:
                q = att.get('query', att)
                sql = q.get('query', q.get('sql', ''))
            elif att.get('type') == 'TEXT' or 'text' in att:
                text = att.get('text', {}).get('content', '')
                if text:
                    answer = text

        return {
            "status": "success",
            "answer": answer,
            "sql": sql,
            "conversation_id": conv_id
        }
