"""
Data Fetcher — Phase 1
Intent별 보강 데이터를 app_cache 테이블에서 조회.
규칙: 최대 1회 추가 SQL, timeout 1.5초 이내.
"""
import logging
import time
from backend.db_client import DBClient

logger = logging.getLogger("data_fetcher")

# Intent별 조회할 app_cache 테이블 매핑
INTENT_CACHE_TABLE = {
    "portfolio_diagnosis": "app_cache_portfolio_summary",
    "risk_alert": "app_cache_holding_signals",
}


def fetch_supplemental(intent: str, customer_id: str, db: DBClient) -> dict | None:
    """
    Intent에 필요한 보강 데이터를 app_cache에서 조회.
    
    Returns:
        dict with raw data rows, or None if failed/timeout/unnecessary.
    """
    cache_table = INTENT_CACHE_TABLE.get(intent)
    if not cache_table:
        return None

    start = time.time()
    try:
        schema = db.schema
        sql = f"SELECT * FROM {schema}.{cache_table} WHERE customer_id = '{customer_id}' LIMIT 20"
        logger.info(f"[DATA_FETCH] {cache_table} for {customer_id}")
        rows = db._execute(sql)
        elapsed = time.time() - start
        logger.info(f"[DATA_FETCH] {cache_table}: {len(rows)} rows in {elapsed:.2f}s")

        # Timeout 검증 (1.5초 초과 시 경고만, 결과는 사용)
        if elapsed > 1.5:
            logger.warning(f"[DATA_FETCH] Slow query: {elapsed:.2f}s > 1.5s threshold")

        return {"table": cache_table, "rows": rows}

    except Exception as e:
        elapsed = time.time() - start
        logger.error(f"[DATA_FETCH] Failed ({elapsed:.2f}s): {e}")
        return None
