"""
App Cache 테이블 SQL Warehouse 조회 클라이언트.
Databricks App 환경에서 WorkspaceClient 자동 인증.
"""
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementState
import os


class DBClient:
    def __init__(self):
        self.w = WorkspaceClient()
        self.warehouse_id = os.environ.get("DATABRICKS_WAREHOUSE_ID")
        self.schema = os.environ.get("APP_CACHE_SCHEMA", "dev.ai_pb_gold")

    def _execute(self, sql: str) -> list[dict]:
        """SQL 실행 후 dict 리스트 반환."""
        resp = self.w.statement_execution.execute_statement(
            warehouse_id=self.warehouse_id,
            statement=sql,
            wait_timeout="30s"
        )
        if resp.status.state != StatementState.SUCCEEDED:
            raise RuntimeError(
                f"Query failed: {resp.status.error}" if resp.status.error
                else f"Query state: {resp.status.state}"
            )
        cols = [c.name for c in resp.manifest.schema.columns]
        rows = []
        if resp.result and resp.result.data_array:
            for row in resp.result.data_array:
                rows.append(dict(zip(cols, row)))
        return rows

    def _t(self, table_name: str) -> str:
        """Full table path."""
        return f"{self.schema}.{table_name}"

    # ============================================================
    # Dashboard (홈 집계)
    # ============================================================
    def get_dashboard(self) -> dict:
        rows = self._execute(
            f"SELECT * FROM {self._t('app_cache_dashboard')} LIMIT 1"
        )
        return rows[0] if rows else {}

    # ============================================================
    # Portfolio Summary [화면5]
    # ============================================================
    def get_portfolio_summary(self, customer_id: str) -> dict:
        rows = self._execute(f"""
            SELECT *
            FROM {self._t('app_cache_portfolio_summary')}
            WHERE customer_id = '{customer_id}'
        """)
        return rows[0] if rows else {}

    # ============================================================
    # Holding Signals [화면2]
    # ============================================================
    def get_holding_signals(self, customer_id: str, limit: int = 10) -> list[dict]:
        return self._execute(f"""
            SELECT *
            FROM {self._t('app_cache_holding_signals')}
            WHERE customer_id = '{customer_id}'
            ORDER BY date DESC, rn ASC
            LIMIT {limit}
        """)

    # ============================================================
    # Unexpected Signals [화면1]
    # ============================================================
    def get_unexpected_signals(self, limit: int = 4) -> list[dict]:
        return self._execute(f"""
            SELECT event_id, event_title, event_type, event_subtype,
                   related_sector, ai_investment_view,
                   impacted_assets_json, importance_score
            FROM {self._t('app_cache_news_feed')}
            WHERE event_type NOT IN ('실적발표', '배당')
              AND importance_score IS NOT NULL
            ORDER BY importance_score DESC, sort_timestamp DESC
            LIMIT {limit}
        """)

    # ============================================================
    # Market Events [화면3]
    # ============================================================
    def get_market_events(self, limit: int = 5) -> list[dict]:
        return self._execute(f"""
            SELECT event_id, event_title, event_type, event_subtype,
                   related_sector, related_theme, ai_investment_view,
                   sentiment_score, impacted_asset_count,
                   impacted_assets_json, published_at
            FROM {self._t('app_cache_news_feed')}
            WHERE event_type IN ('금리정책', '매크로지표', '산업이벤트', '외교이벤트', '실적발표')
            ORDER BY sort_timestamp DESC
            LIMIT {limit}
        """)

    # ============================================================
    # Market Overview
    # ============================================================
    def get_market_overview(self, segment: str = None) -> list[dict]:
        where = f"WHERE market_segment = '{segment}'" if segment else ""
        return self._execute(f"""
            SELECT *
            FROM {self._t('app_cache_market_overview')}
            {where}
            ORDER BY asset_count DESC
        """)

    # ============================================================
    # Schedules [화면4]
    # ============================================================
    def get_schedules(self, limit: int = 10) -> list[dict]:
        return self._execute(f"""
            SELECT event_id, event_title, event_type, event_subtype,
                   related_sector, event_summary, published_at
            FROM {self._t('app_cache_news_feed')}
            WHERE event_type IN ('실적발표', '배당', 'ELS상환', '매크로지표')
            ORDER BY sort_timestamp DESC
            LIMIT {limit}
        """)

    # ============================================================
    # Customer Alerts
    # ============================================================
    def get_customer_alerts(
        self, customer_id: str = None, priority: str = None
    ) -> list[dict]:
        conditions = []
        if customer_id:
            conditions.append(f"customer_id = '{customer_id}'")
        if priority:
            conditions.append(f"alert_priority = '{priority}'")
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        return self._execute(f"""
            SELECT customer_id, customer_name, alert_priority,
                   total_insight_count, high_impact_count,
                   top_action_recommendation, top_action_asset,
                   top_action_reason, consultation_needed,
                   insight_summary
            FROM {self._t('app_cache_customer_alerts')}
            {where}
            ORDER BY CASE alert_priority
                WHEN 'CRITICAL' THEN 1
                WHEN 'HIGH' THEN 2
                WHEN 'MEDIUM' THEN 3
                ELSE 4 END
            LIMIT 50
        """)

    # ============================================================
    # Top Investors [화면6]
    # ============================================================
    def get_top_investors(self, limit: int = 4) -> list[dict]:
        return self._execute(f"""
            SELECT *
            FROM {self._t('app_top_investor_cache')}
            ORDER BY rank ASC
            LIMIT {limit}
        """)
