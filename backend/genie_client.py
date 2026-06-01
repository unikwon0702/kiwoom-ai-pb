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
        display_name = customer_name or customer_id
        ctx = f"[SELECTED_CUSTOMER_CONTEXT]\ncustomer_id: {customer_id}\n"
        if customer_name:
            ctx += f"customer_name: {customer_name}\n"
        ctx += f"[/SELECTED_CUSTOMER_CONTEXT]\n\n"
        ctx += f"조회 조건: 반드시 WHERE customer_id = '{customer_id}' 조건을 사용하세요.\n"
        ctx += f"답변 규칙: 답변에서 고객을 지칭할 때 customer_id(CUST0010 등)를 절대 노출하지 마세요. 반드시 '{display_name}' 또는 '{display_name}님'으로만 표현하세요.\n\n"
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
        answer = ''
        sql = None
        table_data = None
        statement_id = None
        suggested_questions = []
        description = ''

        for att in response.get('attachments', []):
            # SQL query + statement_id
            if 'query' in att:
                q = att['query']
                sql = q.get('query', q.get('sql', ''))
                statement_id = q.get('statement_id')
                # Extract Genie's interpretation of the question
                if q.get('description'):
                    description = q['description']
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

        return {
            "status": "success",
            "answer": answer,
            "description": description,
            "sql": sql,
            "table_data": table_data,
            "conversation_id": conv_id,
            "suggested_questions": suggested_questions[:3] if suggested_questions else []
        }

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
