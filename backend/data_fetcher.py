"""
Data Fetcher — Phase 1 (Multi-table)
Intent별 복수 Gold 테이블을 조회하여 풍부한 section 데이터 제공.
규칙: 전체 보강 조회 총 3초 이내, 개별 쿼리 실패 시 skip.
"""
import logging
import time
from backend.db_client import DBClient

logger = logging.getLogger("data_fetcher")

SCHEMA = "dev.ai_pb_gold"

# ============================================================
# Intent별 조회 테이블 정의 (Phase 1: portfolio_diagnosis + risk_alert)
# ============================================================

INTENT_QUERIES = {
    "portfolio_diagnosis": [
        {
            "key": "diagnosis",
            "sql": f"SELECT * FROM {SCHEMA}.gd_serving_portfolio_diagnosis WHERE customer_id = '{{cid}}' LIMIT 1",
        },
        {
            "key": "signals",
            "sql": f"SELECT asset_name, signal_name, signal_category, signal_interpretation, risk_notice_required FROM {SCHEMA}.gd_customer_portfolio_signal WHERE customer_id = '{{cid}}' LIMIT 10",
        },
        {
            "key": "insight_cards",
            "sql": f"SELECT title, summary, impact_level, published_at, action_recommendation FROM {SCHEMA}.gd_pb_insight_card WHERE customer_id = '{{cid}}' ORDER BY published_at DESC LIMIT 5",
        },
        {
            "key": "rebalancing",
            "sql": f"SELECT rebalance_needed, rebalance_urgency, rebalance_action_summary, overweight_assets, loss_cut_candidates FROM {SCHEMA}.gd_serving_rebalancing_action WHERE customer_id = '{{cid}}' LIMIT 1",
        },
    ],
    "risk_alert": [
        {
            "key": "signals",
            "sql": f"SELECT asset_name, signal_name, signal_category, signal_interpretation, risk_notice_required, valuation_amount, holding_weight FROM {SCHEMA}.gd_customer_portfolio_signal WHERE customer_id = '{{cid}}' LIMIT 15",
        },
        {
            "key": "insight_cards",
            "sql": f"SELECT title, summary, impact_level, published_at, action_recommendation FROM {SCHEMA}.gd_pb_insight_card WHERE customer_id = '{{cid}}' ORDER BY published_at DESC LIMIT 5",
        },
    ],
    "holding_risk_check": [
        {
            "key": "signals",
            "sql": f"SELECT asset_name, signal_name, signal_category, signal_interpretation, risk_notice_required FROM {SCHEMA}.gd_customer_portfolio_signal WHERE customer_id = '{{cid}}' AND risk_notice_required = true LIMIT 10",
        },
    ],
    "rebalancing_recommendation": [
        {
            "key": "rebalancing",
            "sql": f"SELECT * FROM {SCHEMA}.gd_serving_rebalancing_action WHERE customer_id = '{{cid}}' LIMIT 1",
        },
    ],
}


def fetch_supplemental(intent: str, customer_id: str, db: DBClient) -> dict | None:
    """
    Intent에 필요한 보강 데이터를 Gold 테이블에서 복수 조회 (순차).
    
    Returns:
        dict: { "diagnosis": [...rows], "signals": [...rows], ... }
        각 key는 조회 결과 (list of dict). 실패 시 해당 key 없음.
    """
    queries = INTENT_QUERIES.get(intent)
    if not queries:
        return None

    start = time.time()
    results = {}

    for q in queries:
        key = q["key"]
        sql = q["sql"].replace("{cid}", customer_id)

        try:
            elapsed_so_far = time.time() - start
            if elapsed_so_far > 3.0:
                logger.warning(f"[DATA_FETCH] Total timeout reached ({elapsed_so_far:.2f}s), skipping {key}")
                break

            rows = db._execute(sql)
            results[key] = rows
            logger.info(f"[DATA_FETCH] {key}: {len(rows)} rows")

        except Exception as e:
            logger.warning(f"[DATA_FETCH] {key} failed: {e}")
            continue  # 개별 실패는 skip

    elapsed = time.time() - start
    logger.info(f"[DATA_FETCH] Total: {len(results)} sources in {elapsed:.2f}s")

    return results if results else None


# ============================================================
# 병렬 조회 (V2용) — Intent 결정 전에 전체 테이블 동시 조회
# ============================================================

# 전체 데이터 소스 (intent 무관하게 모두 조회)
ALL_SOURCES = [
    {"key": "diagnosis", "sql": f"SELECT * FROM {SCHEMA}.gd_serving_portfolio_diagnosis WHERE customer_id = '{{cid}}' LIMIT 1"},
    {"key": "signals", "sql": f"SELECT asset_name, signal_name, signal_category, signal_interpretation, risk_notice_required FROM {SCHEMA}.gd_customer_portfolio_signal WHERE customer_id = '{{cid}}' LIMIT 10"},
    {"key": "insight_cards", "sql": f"SELECT title, summary, impact_level, published_at, action_recommendation FROM {SCHEMA}.gd_pb_insight_card WHERE customer_id = '{{cid}}' ORDER BY published_at DESC LIMIT 5"},
    {"key": "rebalancing", "sql": f"SELECT rebalance_needed, rebalance_urgency, rebalance_action_summary, overweight_assets, loss_cut_candidates FROM {SCHEMA}.gd_serving_rebalancing_action WHERE customer_id = '{{cid}}' LIMIT 1"},
]


def fetch_all_parallel(customer_id: str, db: DBClient) -> dict:
    """
    모든 데이터 소스를 병렬로 조회. Intent 결정 전에 호출.
    ThreadPoolExecutor로 4개 쿼리 동시 실행 → 최대 소요시간 = 가장 느린 1개 쿼리.
    
    Returns:
        dict: { "diagnosis": [...], "signals": [...], "insight_cards": [...], "rebalancing": [...] }
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    start = time.time()
    results = {}

    def _run_query(key: str, sql: str):
        try:
            rows = db._execute(sql)
            return key, rows
        except Exception as e:
            logger.warning(f"[DATA_FETCH_PARALLEL] {key} failed: {e}")
            return key, None

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = []
        for src in ALL_SOURCES:
            sql = src["sql"].replace("{cid}", customer_id)
            futures.append(executor.submit(_run_query, src["key"], sql))

        for future in as_completed(futures):
            key, rows = future.result()
            if rows is not None:
                results[key] = rows

    elapsed = time.time() - start
    logger.info(f"[DATA_FETCH_PARALLEL] {len(results)} sources in {elapsed:.2f}s")
    return results
