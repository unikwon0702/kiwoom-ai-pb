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
    # Holding Signals [화면2] + enriched content JOIN
    # ============================================================
    def get_holding_signals(self, customer_id: str, limit: int = 5) -> list[dict]:
        """보유 + 관심 자산: 종목당 최신 시그널 1건 + enriched 구어체 텍스트"""
        # 보유 자산 — 종목별 최신 1건 (상위 3종목) + enriched JOIN
        held = self._execute(f"""
            SELECT h.asset_name, h.signal_name, h.signal_category, h.interpretation,
                   h.date, h.holding_type, h.ai_summary, h.time_label,
                   e.sections_json AS enriched_sections
            FROM (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY asset_name ORDER BY date DESC, rn ASC) AS dedup_rn
                FROM {self._t('app_cache_holding_signals')}
                WHERE customer_id = '{customer_id}'
            ) h
            LEFT JOIN {self._t('app_cache_enriched_content')} e
              ON h.asset_name = e.source_id AND e.content_type = 'holding_enrichment'
            WHERE h.dedup_rn = 1
            ORDER BY h.date DESC
            LIMIT 3
        """)

        # 관심 자산 — 종목별 최신 시그널 1건 (상위 2종목)
        try:
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
        except Exception:
            interest = []

        combined = held + interest
        return combined[:limit]

    # ============================================================
    # Unexpected Signals [화면1]
    # ============================================================
    def get_unexpected_signals(self, limit: int = 4) -> list[dict]:
        """의외의 신호: enriched_content JOIN으로 구어체 콘텐츠 포함 반환"""
        return self._execute(f"""
            WITH deduped AS (
              SELECT event_id, event_title, event_type, event_subtype,
                     related_sector, ai_investment_view,
                     impacted_assets_json, importance_score, sort_timestamp,
                     ROW_NUMBER() OVER (PARTITION BY event_title ORDER BY sort_timestamp DESC) as rn
              FROM {self._t('app_cache_news_feed')}
              WHERE event_type = '뉴스'
                AND importance_score IS NOT NULL
                AND ai_investment_view IS NOT NULL
                AND impacted_assets_json IS NOT NULL
                AND event_title NOT LIKE '%[속보]%'
                AND event_title NOT LIKE '%마감%'
                AND event_title NOT LIKE '%환율,%'
                AND event_title NOT LIKE '%코스피 %'
                AND event_title NOT LIKE '%코스닥 %'
                AND event_title NOT LIKE '%표]%'
                AND event_title NOT LIKE '%전일 대비%'
                AND event_title NOT LIKE '%장중 속보%'
            )
            SELECT d.event_id, d.event_title, d.event_type, d.event_subtype,
                   d.related_sector, d.ai_investment_view,
                   d.impacted_assets_json, d.importance_score,
                   e.headline AS enriched_headline,
                   e.tag AS enriched_tag,
                   e.sections_json AS enriched_sections
            FROM deduped d
            LEFT JOIN {self._t('app_cache_enriched_content')} e
              ON d.event_id = e.source_id AND e.content_type = 'unexpected_enrichment'
            WHERE d.rn = 1
            ORDER BY
                d.importance_score DESC,
                d.sort_timestamp DESC NULLS LAST,
                d.event_id DESC  -- 동일 score/timestamp 시 최신 이벤트 우선 (결정론적)
            LIMIT {limit}
        """)

    # ============================================================
    # Market Events [화면3]
    # ============================================================
    def get_market_events(self, customer_id: str = "CUST0010", limit: int = 5) -> list[dict]:
        """이벤트·시황: 고객 보유종목 관련 뉴스 (중복·루틴 제외, sector 추출)"""
        return self._execute(f"""
            WITH customer_assets AS (
              SELECT DISTINCT asset_name
              FROM {self._t('app_cache_holding_signals')}
              WHERE customer_id = '{customer_id}'
            ),
            matching_news AS (
              SELECT n.event_id, n.event_title, n.event_type, n.event_subtype,
                     COALESCE(n.related_sector, GET_JSON_OBJECT(n.impacted_assets_json, '$[0].sector')) as related_sector,
                     n.related_theme, n.ai_investment_view,
                     n.sentiment_score, n.impacted_asset_count,
                     n.impacted_assets_json, n.published_at, n.sort_timestamp,
                     GET_JSON_OBJECT(n.impacted_assets_json, '$[0].asset_name') as primary_asset,
                     GET_JSON_OBJECT(n.impacted_assets_json, '$[0].impact_direction') as impact_direction,
                     ROW_NUMBER() OVER (PARTITION BY n.event_title ORDER BY n.sort_timestamp DESC) as rn
              FROM {self._t('app_cache_news_feed')} n
              INNER JOIN customer_assets ca
                ON n.impacted_assets_json LIKE CONCAT('%', ca.asset_name, '%')
              WHERE n.event_type = '뉴스'
                AND n.ai_investment_view IS NOT NULL
                AND n.impacted_assets_json IS NOT NULL
                AND n.published_at >= CURRENT_DATE() - 30
                AND n.event_title NOT LIKE '%[속보]%'
                AND n.event_title NOT LIKE '%마감%'
                AND n.event_title NOT LIKE '%전일 대비%'
                AND n.event_title NOT LIKE '%표]%'
            )
            SELECT m.event_id, m.event_title, m.event_type, m.event_subtype,
                   m.related_sector, m.related_theme, m.ai_investment_view,
                   m.sentiment_score, m.impacted_asset_count,
                   m.impacted_assets_json, m.published_at,
                   m.primary_asset, m.impact_direction,
                   e.sections_json AS enriched_sections
            FROM matching_news m
            LEFT JOIN {self._t('app_cache_enriched_content')} e
              ON m.event_id = e.source_id AND e.content_type = 'event_enrichment'
            WHERE m.rn = 1
            ORDER BY m.sort_timestamp DESC
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
    # Schedules [화면4] — 3-레이어 통합 쿼리
    # 레이어1: 고객 보유 파생결합증권 조기상환 가능 (gd_signal_bundle_serving)
    # 레이어2: 고객 보유 종목 관련 주총/배당 (app_cache_news_feed, 노이즈 제거)
    # 레이어3: 매크로 고중요도 일정 (upcoming_macro_calendar)
    # ============================================================
    def get_schedules(self, customer_id: str = 'CUST0010', limit: int = 10) -> list[dict]:
        return self._execute(f"""
            WITH customer_assets AS (
                SELECT DISTINCT asset_name
                FROM {self._t('app_cache_holding_signals')}
                WHERE customer_id = '{customer_id}'
            ),
            -- 레이어1: 조기상환 가능 파생결합증권 (signal 기반, 7일 내 평가일 추정)
            layer_els AS (
                SELECT
                    s.asset_name AS event_id,
                    s.asset_name AS event_title,
                    'ELS상환'    AS event_type,
                    '조기상환'   AS event_subtype,
                    s.interpretation AS event_summary,
                    NULL AS related_sector,
                    DATE_ADD(CURRENT_DATE(), 7) AS scheduled_date,
                    NULL AS enriched_title,
                    NULL AS enriched_sections,
                    1 AS layer_priority,
                    ROW_NUMBER() OVER (PARTITION BY s.asset_name ORDER BY s.signal_date DESC) AS rn
                FROM dev.ai_pb_gold.gd_signal_bundle_serving s
                INNER JOIN customer_assets ca ON s.asset_name = ca.asset_name
                WHERE s.signal_code = 'EARLY_REDEMPTION_LIKELY'
            ),
            -- 레이어2: 고객 보유 종목 관련 주총/배당 (행정공시 노이즈 제거)
            layer_news AS (
                SELECT
                    n.event_id,
                    n.event_title,
                    n.event_type,
                    n.event_subtype,
                    n.event_summary,
                    n.related_sector,
                    n.scheduled_date,
                    e.headline AS enriched_title,
                    e.sections_json AS enriched_sections,
                    2 AS layer_priority,
                    ROW_NUMBER() OVER (
                        PARTITION BY n.event_title, n.scheduled_date
                        ORDER BY n.published_at DESC
                    ) AS rn
                FROM {self._t('app_cache_news_feed')} n
                LEFT JOIN {self._t('app_cache_enriched_content')} e
                    ON n.event_id = e.source_id AND e.content_type = 'schedule_enrichment'
                WHERE n.event_type IN ('주총', '배당')
                  AND n.scheduled_date >= CURRENT_DATE()
                  AND n.scheduled_date <= DATE_ADD(CURRENT_DATE(), 60)
                  AND n.event_subtype NOT LIKE '%투자설명서%'
                  AND n.event_subtype NOT LIKE '%기재정정%'
                  AND EXISTS (
                      SELECT 1 FROM customer_assets ca
                      WHERE n.event_title LIKE CONCAT('%', ca.asset_name, '%')
                  )
            ),
            -- 레이어3: 매크로 고중요도 일정
            layer_macro AS (
                SELECT
                    event_id,
                    event_title,
                    event_type,
                    event_subtype,
                    event_summary,
                    related_sector,
                    scheduled_date,
                    NULL AS enriched_title,
                    NULL AS enriched_sections,
                    3 AS layer_priority,
                    ROW_NUMBER() OVER (
                        PARTITION BY event_title, scheduled_date
                        ORDER BY scheduled_date ASC
                    ) AS rn
                FROM dev.ai_pb_gold.upcoming_macro_calendar
                WHERE scheduled_date >= CURRENT_DATE()
                  AND scheduled_date <= DATE_ADD(CURRENT_DATE(), 30)
                  AND importance = 'high'
            ),
            combined AS (
                SELECT event_id, event_title, event_type, event_subtype,
                       event_summary, related_sector, scheduled_date,
                       enriched_title, enriched_sections, layer_priority
                FROM layer_els  WHERE rn = 1
                UNION ALL
                SELECT event_id, event_title, event_type, event_subtype,
                       event_summary, related_sector, scheduled_date,
                       enriched_title, enriched_sections, layer_priority
                FROM layer_news WHERE rn = 1
                UNION ALL
                SELECT event_id, event_title, event_type, event_subtype,
                       event_summary, related_sector, scheduled_date,
                       enriched_title, enriched_sections, layer_priority
                FROM layer_macro WHERE rn = 1
            )
            SELECT *,
                   DATEDIFF(scheduled_date, CURRENT_DATE()) AS d_days
            FROM combined
            ORDER BY layer_priority ASC, scheduled_date ASC
            LIMIT {limit}
        """)


    # ============================================================
    # Schedule Detail (일정 상세 팝업 — UpcomingScheduleDetailContent 포맷)
    # ============================================================
    def get_schedule_detail(self, event_id: str) -> dict:
        import json as _json
        from datetime import date as _date, datetime as _datetime, timedelta

        def _calc_d_tag(sd):
            try:
                if isinstance(sd, str):
                    sd = _datetime.strptime(sd[:10], '%Y-%m-%d').date()
                diff = (sd - _date.today()).days
                return (f"D-{diff}" if diff > 0 else "D-Day" if diff == 0 else f"D+{abs(diff)}"), sd
            except:
                return "D-?", None

        def _fmt_date(sd):
            try:
                if isinstance(sd, str):
                    sd = _datetime.strptime(sd[:10], '%Y-%m-%d').date()
                WEEKDAY_KO = ['월', '화', '수', '목', '금', '토', '일']
                return f"{sd.month}/{sd.day}({WEEKDAY_KO[sd.weekday()]})"
            except:
                return ''

        # 레이어1 ELS/DLB: event_id가 자산명 (signal 기반)
        sig_row = self._execute(f"""
            SELECT DISTINCT asset_name, interpretation, signal_date
            FROM dev.ai_pb_gold.gd_signal_bundle_serving
            WHERE asset_name = '{event_id}'
              AND signal_code = 'EARLY_REDEMPTION_LIKELY'
            LIMIT 1
        """)
        if sig_row:
            sig = sig_row[0]
            eval_date = _date.today() + timedelta(days=7)
            return {
                "d_tag": "D-7",
                "date": _fmt_date(eval_date),
                "title": sig['asset_name'],
                "summary": "조기상환 평가일이 다가오고 있어요",
                "summary_icon": "⏰",
                "summary_label": "조기상환 안내",
                "ai_summary": sig.get('interpretation') or "조기상환 확률이 높은 구간이에요",
                "summary_sub": "기초자산 종가 확인 후 상환 여부가 결정돼요",
                "reasons_icon": "💡",
                "reasons_label": "이 일정에서 주목할 점",
                "key_points": [
                    "조기상환 기준가 대비 현재 가격 확인이 필요해요",
                    "상환될 경우 수익금과 원금이 함께 지급돼요",
                    "미상환 시 다음 평가일까지 계속 보유하게 돼요",
                ],
                "past_cases": [],
                "related_assets": [],
            }

        # 레이어2~3: 일반 이벤트 (app_cache_news_feed)
        row = self._execute(f"""
            SELECT n.event_id, n.event_title, n.event_type, n.event_subtype,
                   n.related_sector, n.event_summary, n.ai_investment_view,
                   n.scheduled_date, n.importance_score,
                   e.sections_json AS enriched_sections
            FROM {self._t('app_cache_news_feed')} n
            LEFT JOIN {self._t('app_cache_enriched_content')} e
              ON n.event_id = e.source_id AND e.content_type = 'schedule_enrichment'
            WHERE n.event_id = '{event_id}'
            LIMIT 1
        """)
        if not row:
            # upcoming_macro_calendar에서 조회
            row = self._execute(f"""
                SELECT event_id, event_title, event_type, event_subtype,
                       related_sector, event_summary,
                       NULL AS ai_investment_view, scheduled_date,
                       NULL AS importance_score, NULL AS enriched_sections
                FROM dev.ai_pb_gold.upcoming_macro_calendar
                WHERE event_id = '{event_id}'
                LIMIT 1
            """)
        if not row:
            return {}

        event = row[0]
        d_tag, _ = _calc_d_tag(event.get('scheduled_date'))
        date_str = _fmt_date(event.get('scheduled_date')) if event.get('scheduled_date') else ''

        # enriched_sections 우선
        if event.get('enriched_sections'):
            try:
                sec = _json.loads(event['enriched_sections'])
                return {
                    "d_tag": d_tag,
                    "date": date_str,
                    "title": sec.get('title_friendly', event['event_title']),
                    "summary": sec.get('summary', ''),
                    "summary_icon": "🤖",
                    "summary_label": "AI 이벤트 요약",
                    "ai_summary": sec.get('ai_summary') or sec.get('summary', event.get('ai_investment_view', '')),
                    "summary_sub": sec.get('summarySub', event.get('event_summary', '')),
                    "reasons_icon": "💡",
                    "reasons_label": "이 일정에서 주목할 점",
                    "key_points": sec.get('key_points') or sec.get('reasons', []),
                    "past_cases": sec.get('past_cases', []),
                    "related_assets": sec.get('related_assets', []),
                }
            except:
                pass

        # FM 호출 (캐시 없을 때)
        ai_view = event.get('ai_investment_view', '')
        try:
            ai_resp = self._generate_schedule_opinion(event, d_tag)
            return {
                "d_tag": d_tag,
                "date": date_str,
                "title": event['event_title'],
                "summary": ai_view[:60] if ai_view else event.get('event_summary', ''),
                "summary_icon": "🤖",
                "summary_label": "AI 이벤트 요약",
                "ai_summary": ai_resp.get('ai_summary', ai_view),
                "summary_sub": ai_resp.get('summary_sub', event.get('event_summary', '')),
                "reasons_icon": "💡",
                "reasons_label": "이 일정에서 주목할 점",
                "key_points": ai_resp.get('key_points', [ai_view] if ai_view else []),
                "past_cases": ai_resp.get('past_cases', []),
                "related_assets": [],
            }
        except:
            summary_text = ai_view[:60] if ai_view else event.get('event_summary', f"{event['event_title']} 일정이에요.")
            return {
                "d_tag": d_tag,
                "date": date_str,
                "title": event['event_title'],
                "summary": summary_text,
                "summary_icon": "🤖",
                "summary_label": "AI 이벤트 요약",
                "ai_summary": ai_view or f"{event['event_title']} 일정이 다가오고 있어요.",
                "summary_sub": event.get('event_summary', ''),
                "reasons_icon": "💡",
                "reasons_label": "이 일정에서 주목할 점",
                "key_points": [ai_view] if ai_view else ["해당 일정에 주의가 필요해요."],
                "past_cases": [],
                "related_assets": [],
            }

    def _generate_schedule_opinion(self, event: dict, d_tag: str = 'D-?') -> dict:
        """FM 모델로 일정 이벤트 AI 의견 생성 (UpcomingScheduleDetailContent 포맷)"""
        import json as _json
        from databricks.sdk import WorkspaceClient

        w = WorkspaceClient()
        prompt = f"""아래 투자 일정 이벤트를 분석해주세요:
- 이벤트: {event['event_title']}
- 타입: {event.get('event_type', '')} / {event.get('event_subtype', '')}
- 관련섹터: {event.get('related_sector', '')}
- D-day: {d_tag}

반드시 아래 JSON 형식으로만 응답하세요 (한국어, 존댓말):
{{
  "ai_summary": "핵심 요약 1문장 (30자 이내)",
  "summary_sub": "부연 설명 1문장 (50자 이내)",
  "key_points": ["주목 포인트1 (20자 이내)", "포인트2", "포인트3"],
  "past_cases": [{{"date": "YYYY.MM", "result": "과거 유사 사례 (40자 이내)"}}]
}}"""

        response = w.api_client.do(
            "POST",
            "/serving-endpoints/databricks-claude-sonnet-4/invocations",
            body={
                "messages": [
                    {"role": "system", "content": "당신은 키움증권 AI PB입니다. 고객에게 투자 일정을 친절하고 실질적으로 설명합니다. JSON으로만 응답하세요."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 600,
                "temperature": 0.3
            }
        )
        ai_text = response["choices"][0]["message"]["content"]
        clean = ai_text.strip().removeprefix("```json").removesuffix("```").strip()
        return _json.loads(clean)

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
    # Event Detail (뉴스 상세 + enriched content JOIN)
    # ============================================================
    def get_event_detail(self, event_id: str, customer_id: str = 'CUST0010') -> dict:
        rows = self._execute(f"""
            SELECT n.event_id, n.event_title, n.event_type, n.event_subtype,
                   n.related_sector, n.related_theme, n.ai_investment_view,
                   n.event_summary, n.news_summary, n.tags_json,
                   n.impacted_assets_json, n.sentiment_score, n.importance_score,
                   n.published_at,
                   e.sections_json AS enriched_sections
            FROM {self._t('app_cache_news_feed')} n
            LEFT JOIN {self._t('app_cache_enriched_content')} e
              ON n.event_id = e.source_id AND e.content_type = 'event_enrichment'
            WHERE n.event_id = '{event_id}'
            LIMIT 1
        """)
        if not rows:
            return {}
        event = rows[0]

        # 고객 보유/관심 종목 교차 → impacted_assets_json에 holding 필드 주입
        try:
            holding_rows = self._execute(f"""
                SELECT DISTINCT asset_name FROM {self._t('app_cache_holding_signals')}
                WHERE customer_id = '{customer_id}'
            """)
            held_set = {{r['asset_name'] for r in holding_rows}}

            interest_rows = self._execute(f"""
                SELECT DISTINCT asset_name FROM {self._t('gd_customer_interest_serving')}
                WHERE customer_id = '{customer_id}'
            """)
            interest_set = {{r['asset_name'] for r in interest_rows}}

            raw = event.get('impacted_assets_json')
            if raw:
                import json as _json
                assets = _json.loads(raw) if isinstance(raw, str) else raw
                for a in assets:
                    name = a.get('asset_name', '')
                    if name in held_set:
                        a['holding'] = '보유'
                    elif name in interest_set:
                        a['holding'] = '관심'
                    else:
                        a['holding'] = None
                event['impacted_assets_json'] = _json.dumps(assets, ensure_ascii=False)
        except Exception:
            pass

        # 섹터 신호 강도 추이 (최근 8주 주별)
        sector = event.get('related_sector', '')
        chart_data = []
        if sector:
            try:
                chart_rows = self._execute(f"""
                    SELECT
                        DATE_FORMAT(DATE_TRUNC('week', published_at), 'M/d') AS label,
                        CAST(ROUND(AVG(CAST(importance_score AS DOUBLE)) * 100) AS INT) AS value,
                        COUNT(*) AS cnt
                    FROM {self._t('app_cache_news_feed')}
                    WHERE related_sector = '{sector}'
                      AND published_at >= CURRENT_DATE() - 56
                      AND importance_score IS NOT NULL
                    GROUP BY DATE_TRUNC('week', published_at)
                    ORDER BY DATE_TRUNC('week', published_at)
                    LIMIT 8
                """)
                chart_data = [
                    {"label": r["label"], "value": int(r["value"] or 0), "count": int(r["cnt"] or 0)}
                    for r in chart_rows
                ]
            except Exception:
                chart_data = []

        event['chart_data'] = chart_data
        return event

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

        # 6. Enriched content (구어체)
        enriched = self._execute(f"""
            SELECT sections_json FROM {self._t('app_cache_enriched_content')}
            WHERE source_id = '{asset_name}' AND content_type = 'holding_enrichment'
            LIMIT 1
        """)
        enriched_data = {}
        if enriched and enriched[0].get('sections_json'):
            import json as _json2
            try:
                enriched_data = _json2.loads(enriched[0]['sections_json'])
            except:
                pass

        # 7. MasterTradeChart 데이터
        chart_groups_rows = self._execute(f"""
            SELECT investor_group_key, investor_group_label,
                   trade_label, buy_volume, sell_volume,
                   highlight_type, highlight_note
            FROM dev.ai_pb_gold.app_cache_master_trade_chart
            WHERE asset_name = '{asset_name}'
            ORDER BY investor_group_key, trade_date ASC
        """)
        chart_groups = []
        if chart_groups_rows:
            from collections import defaultdict as _dd
            _gd = _dd(list)
            _gl = {}
            for _r in chart_groups_rows:
                _k = _r['investor_group_key']
                _gl[_k] = _r['investor_group_label']
                _pt = {"date": _r['trade_label'], "buy": _r['buy_volume'], "sell": _r['sell_volume']}
                if _r.get('highlight_type'):
                    _pt["highlight"] = {"type": _r['highlight_type'], "note": _r['highlight_note'] or ""}
                _gd[_k].append(_pt)
            for _k in ["aggressive", "longterm"]:
                if _k in _gd:
                    chart_groups.append({"key": _k, "label": _gl[_k], "data": _gd[_k]})

        # 조합
        diag = diagnosis[0] if diagnosis else {}
        hold = holding_info[0] if holding_info else {}
        interpretations = [s.get('interpretation', '') for s in signals if s.get('interpretation')]
        signal_names = [s.get('signal_name', '') for s in signals if s.get('signal_name')]

        # enriched가 있으면 구어체 사용, 없으면 기존 로직
        if enriched_data.get('summary'):
            summary = enriched_data['summary']
        else:
            summary = f"{', '.join(signal_names[:2])} 시그널이 감지됐어요." if signal_names else "최근 변동사항을 확인해보세요."
        
        if enriched_data.get('summarySub'):
            summary_sub = enriched_data['summarySub']
        else:
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

        # enriched reasons 우선 사용
        if enriched_data.get('reasons'):
            reasons_list = enriched_data['reasons']
        else:
            reasons_list = interpretations[:4] if interpretations else ["시그널 데이터를 분석 중이에요."]

        # 보유/관심 태그 추론: holding_info가 비어 있으면 관심 자산
        inferred_tag = '관심' if not holding_info else '보유'

        return {
            "tag": inferred_tag,
            "title": asset_name,
            "summary": summary,
            "summarySub": summary_sub,
            "reasons": reasons_list,
            "chart": chart_data,
            "buyCount": buy_count,
            "sellCount": sell_count,
            "masters": masters if masters else None,
            "hideMasters": total == 0,
            "pollLabel": poll_label,
            "aiPbSummary": f"투자고수 {total}팀 중 {buy_count}팀이 매수, {sell_count}팀이 매도 흐름이에요." if total > 0 else None,
            "history": history if history else None,
            "chartGroups": chart_groups if chart_groups else None,
            "masterMode": "chart" if chart_groups else "simple",
        }
