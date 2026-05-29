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
    def get_holding_signals(self, customer_id: str, limit: int = 5) -> list[dict]:
        """보유 + 관심 자산: 종목당 최신 시그널 1건만 반환"""
        # 보유 자산 — 종목별 최신 1건 (상위 3종목)
        held = self._execute(f"""
            SELECT asset_name, signal_name, signal_category, interpretation,
                   date, holding_type
            FROM (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY asset_name ORDER BY date DESC, rn ASC) AS dedup_rn
                FROM {self._t('app_cache_holding_signals')}
                WHERE customer_id = '{customer_id}'
            )
            WHERE dedup_rn = 1
            ORDER BY date DESC
            LIMIT 3
        """)

        # 관심 자산 — 종목별 최신 1건 (상위 2종목)
        interest = self._execute(f"""
            SELECT asset_name, signal_name, signal_category, interpretation,
                   date, '관심' AS holding_type
            FROM (
                SELECT s.asset_name, s.signal_name, s.signal_category,
                       s.interpretation, s.signal_date AS date,
                       ROW_NUMBER() OVER (PARTITION BY s.asset_name ORDER BY s.signal_date DESC) AS dedup_rn
                FROM dev.ai_pb_gold.gd_signal_bundle_serving s
                INNER JOIN dev.ai_pb_gold.gd_customer_interest_serving i
                    ON s.asset_name = i.asset_name AND i.customer_id = '{customer_id}' AND i.interest_type = '관심'
            )
            WHERE dedup_rn = 1
            ORDER BY date DESC
            LIMIT 2
        """)

        combined = held + interest
        return combined[:limit]

    # ============================================================
    # Unexpected Signals [화면1]
    # ============================================================
    def get_unexpected_signals(self, limit: int = 4) -> list[dict]:
        """의외의 신호: importance 상위 이벤트"""
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
        """이벤트·시황: 시장 전반 (의외의 신호 상위 event_id 제외)"""
        return self._execute(f"""
            SELECT event_id, event_title, event_type, event_subtype,
                   related_sector, related_theme, ai_investment_view,
                   sentiment_score, impacted_asset_count,
                   impacted_assets_json, published_at
            FROM {self._t('app_cache_news_feed')}
            WHERE ai_investment_view IS NOT NULL
              AND impacted_assets_json IS NOT NULL
              AND event_id NOT IN (
                  SELECT event_id FROM {self._t('app_cache_news_feed')}
                  WHERE event_type NOT IN ('실적발표', '배당')
                    AND importance_score IS NOT NULL
                  ORDER BY importance_score DESC, sort_timestamp DESC
                  LIMIT 4
              )
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
    # Situation Summary (AI 요약 캐시)
    # ============================================================
    def get_situation_summary(self, customer_id: str) -> dict:
        rows = self._execute(f"""
            SELECT customer_id, customer_name, card_type, summary_text, as_of_date
            FROM {self._t('app_cache_situation_summary')}
            WHERE customer_id = '{customer_id}'
        """)
        result = {
            'customer_id': customer_id,
            'customer_name': '',
            'as_of_date': '',
            'investment_change': {'summary': ''},
            'market_context': {'summary': ''},
            'upcoming_schedule': {'summary': ''},
        }
        for row in rows:
            result['customer_name'] = row.get('customer_name', '')
            result['as_of_date'] = row.get('as_of_date', '')
            card = row.get('card_type', '')
            if card in result:
                result[card] = {'summary': row.get('summary_text', '')}
        return result

    # ============================================================
    # Top Investors [화면6]
    # ============================================================
    def get_top_investors(self, limit: int = 3) -> list[dict]:
        return self._execute(f"""
            SELECT rank, investor_type, investor_emoji,
                   short_status, tags_json, total_asset_krw,
                   holding_count AS avg_holdings,
                   total_return_pct,
                   sector_allocation_json,
                   domestic_top_json, overseas_top_json,
                   daily_buys_json, daily_sells_json,
                   recent_trade_date AS daily_pick_date,
                   cached_at AS cache_updated_at
            FROM (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY investor_type ORDER BY rank ASC) AS rn
                FROM {self._t('app_top_investor_cache')}
            )
            WHERE rn = 1
            ORDER BY rank ASC
            LIMIT {limit}
        """)

    # ============================================================
    # Customer Interests (관심종목 설정)
    # ============================================================
    def get_customer_interests(self, customer_id: str) -> list[dict]:
        return self._execute(f"""
            SELECT asset_name, asset_type, asset_subtype,
                   interest_type, display_rank, already_held_yn
            FROM {self._t('gd_customer_interest_serving')}
            WHERE customer_id = '{customer_id}'
            ORDER BY display_rank ASC
        """)

    # ============================================================
    # Event Detail (뉴스 상세)
    # ============================================================
    def get_event_detail(self, event_id: str) -> dict:
        rows = self._execute(f"""
            SELECT event_id, event_title, event_type, event_subtype,
                   related_sector, related_theme, ai_investment_view,
                   event_summary, news_summary, tags_json,
                   impacted_assets_json, sentiment_score, importance_score,
                   published_at
            FROM {self._t('app_cache_news_feed')}
            WHERE event_id = '{event_id}'
            LIMIT 1
        """)
        return rows[0] if rows else {}

    # ============================================================
    # Holding Detail (종목 상세 팝업)
    # ============================================================
    def get_holding_detail(self, customer_id: str, asset_name: str) -> dict:
        """종목 클릭 시 상세: 시그널, 진단, 고수 평가, 과거 이벤트"""

        # 1. 시그널 (reasons)
        signals = self._execute(f"""
            SELECT signal_name, signal_category, interpretation, signal_date
            FROM dev.ai_pb_gold.gd_signal_bundle_serving
            WHERE asset_name = '{asset_name}'
            ORDER BY signal_date DESC LIMIT 5
        """)

        # 2. 종목 진단
        diagnosis = self._execute(f"""
            SELECT asset_name, sector, overall_diagnosis, rsi, rsi_signal,
                   price_change_rate, cagr_1y, mdd, momentum_signal
            FROM dev.ai_pb_gold.gd_serving_asset_diagnosis
            WHERE asset_name = '{asset_name}' LIMIT 1
        """)

        # 3. 보유 정보
        holding_info = self._execute(f"""
            SELECT holding_type, ai_summary
            FROM {self._t('app_cache_holding_signals')}
            WHERE customer_id = '{customer_id}' AND asset_name = '{asset_name}'
            LIMIT 1
        """)

        # 4. 고수 매매 (유형별 다수결 → 유형당 1개 액션만)
        all_types_info = [
            {"investor_type": "공격형 투자", "investor_emoji": "🔥"},
            {"investor_type": "장기형 투자", "investor_emoji": "💎"},
            {"investor_type": "금상", "investor_emoji": "📊"},
        ]
        buy_counts = self._execute(f"""
            SELECT investor_type, COUNT(*) as cnt
            FROM {self._t('app_top_investor_cache')}
            WHERE daily_buys_json LIKE '%{asset_name}%'
            GROUP BY investor_type
        """)
        sell_counts = self._execute(f"""
            SELECT investor_type, COUNT(*) as cnt
            FROM {self._t('app_top_investor_cache')}
            WHERE daily_sells_json LIKE '%{asset_name}%'
            GROUP BY investor_type
        """)
        buy_map = {r['investor_type']: int(r['cnt']) for r in buy_counts}
        sell_map = {r['investor_type']: int(r['cnt']) for r in sell_counts}

        # 5. 과거 이벤트
        events = self._execute(f"""
            SELECT title, summary, impact_direction, impact_score, reason, published_at
            FROM dev.ai_pb_gold.gd_pb_insight_card
            WHERE related_asset_name = '{asset_name}'
            ORDER BY published_at DESC LIMIT 3
        """)

        # 조합
        diag = diagnosis[0] if diagnosis else {}
        hold = holding_info[0] if holding_info else {}
        interpretations = [s.get('interpretation', '') for s in signals if s.get('interpretation')]
        signal_names = [s.get('signal_name', '') for s in signals if s.get('signal_name')]

        summary = f"{', '.join(signal_names[:2])} 시그널이 감지됐어요." if signal_names else "최근 변동사항을 확인해보세요."
        summary_sub = interpretations[0] if interpretations else diag.get('overall_diagnosis', '')

        # 차트
        pct = float(diag.get('price_change_rate', 0) or 0) * 100
        chart_data = None
        if diag and pct != 0:
            chart_data = {
                "title": "코스피 대비 수익률 (최근 1개월)",
                "gap": f"{pct:+.1f}%p",
                "data": [
                    {"label": "4주 전", "kospi": 1.5, "fund": round(pct * 0.3, 1)},
                    {"label": "3주 전", "kospi": 2.0, "fund": round(pct * 0.5, 1)},
                    {"label": "2주 전", "kospi": 2.5, "fund": round(pct * 0.7, 1)},
                    {"label": "1주 전", "kospi": 3.0, "fund": round(pct * 0.85, 1)},
                    {"label": "오늘", "kospi": 2.8, "fund": round(pct, 1)},
                ],
                "fundLabel": asset_name,
                "caption": f"최근 한 달간 {asset_name}의 수익률 변동 추이예요."
            }

        # 고수 (3유형 각 1개씩, 다수결 기준)
        masters = []
        buy_count = 0
        sell_count = 0
        for t in all_types_info:
            tname = t['investor_type']
            b = buy_map.get(tname, 0)
            s = sell_map.get(tname, 0)
            if b > s:
                masters.append({"emoji": t['investor_emoji'], "name": tname, "note": "매수 진행", "action": "매수"})
                buy_count += 1
            elif s > b:
                masters.append({"emoji": t['investor_emoji'], "name": tname, "note": "일부 매도", "action": "매도"})
                sell_count += 1
            else:
                masters.append({"emoji": t['investor_emoji'], "name": tname, "note": "관망 중", "action": "매수"})
                buy_count += 1
        total = buy_count + sell_count
        poll_label = "전원 매수" if sell_count == 0 else "매수 우위" if buy_count > sell_count else "매도 우위" if sell_count > buy_count else "균형"

        # 과거 사례
        history = []
        for e in events:
            d = "up" if e.get('impact_direction') == '긍정' else "down"
            score = float(e.get('impact_score', 0) or 0)
            change = f"+{score*10:.0f}%" if d == "up" else f"-{score*10:.0f}%"
            date_str = str(e.get('published_at', ''))[:7].replace('-', '.')
            history.append({"date": date_str, "change": change, "direction": d, "text": e.get('reason') or e.get('summary', '')})

        return {
            "tag": hold.get('holding_type', '보유'),
            "title": asset_name,
            "summary": summary,
            "summarySub": summary_sub,
            "reasons": interpretations[:4] if interpretations else ["시그널 데이터를 분석 중이에요."],
            "chart": chart_data,
            "buyCount": buy_count,
            "sellCount": sell_count,
            "masters": masters if masters else None,
            "hideMasters": total == 0,
            "pollLabel": poll_label,
            "aiPbSummary": f"투자고수 {total}팀 중 {buy_count}팀이 매수, {sell_count}팀이 매도 흐름이에요." if total > 0 else None,
            "history": history if history else None,
        }
