"""
Genie Space 대화 API 클라이언트.
AI_PB-Simulation_Test_V4(UPDATE) Space에 질문 전송.
"""
from databricks.sdk import WorkspaceClient
import time
import os


class GenieChatClient:
    def __init__(self, space_id: str = None, timeout: int = 60):
        self.w = WorkspaceClient()
        self.space_id = space_id or os.environ.get("GENIE_SPACE_ID")
        self.timeout = timeout

    def ask(self, question: str, conversation_id: str = None,
            customer_id: str = None, customer_name: str = None) -> dict:
        enriched = self._inject_context(question, customer_id, customer_name)
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

    def _inject_context(self, question, customer_id, customer_name):
        if not customer_id:
            return question
        ctx = f"[SELECTED_CUSTOMER_CONTEXT]\ncustomer_id: {customer_id}\n"
        if customer_name:
            ctx += f"customer_name: {customer_name}\n"
        ctx += f"[/SELECTED_CUSTOMER_CONTEXT]\n\n"
        ctx += f"위 고객의 customer_id를 기준으로 답변해주세요. 반드시 WHERE customer_id = '{customer_id}' 조건을 사용하세요.\n\n"
        ctx += f"사용자 질문:\n{question}"
        return ctx

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
        answer = response.get('content', '')
        sql = None
        table_data = None
        for att in response.get('attachments', []):
            if att.get('type') == 'QUERY' or 'query' in att:
                q = att.get('query', att)
                sql = q.get('query', q.get('sql', ''))
                if 'result' in q:
                    table_data = q['result']
                elif 'data' in q:
                    table_data = q['data']
            elif att.get('type') == 'TEXT' or 'text' in att:
                text = att.get('text', {}).get('content', '')
                if text:
                    answer = text
            elif att.get('type') == 'QUERY_RESULT' or 'query_result' in att:
                qr = att.get('query_result', att)
                table_data = {'columns': qr.get('columns', []), 'rows': qr.get('data_array', qr.get('rows', []))}
        return {"status": "success", "answer": answer, "sql": sql, "table_data": table_data, "conversation_id": conv_id}
