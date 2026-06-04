"""
AI PB Databricks App - FastAPI Backend
React SPA 서빙 + App Cache 테이블 API + Genie Space 챗봇 API
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
import os

from backend.db_client import DBClient
from backend.genie_client import GenieChatClient
from backend.response_builder import build_structured_response

app = FastAPI(title="AI PB App", docs_url="/docs")

# 클라이언트 초기화
db = DBClient()
genie = GenieChatClient()


# ===== Data API Endpoints =====

@app.get("/api/dashboard")
def get_dashboard():
    """홈 화면 집계 데이터"""
    return db.get_dashboard()


@app.get("/api/portfolio-summary")
def get_portfolio_summary(customer_id: str = Query(default="CUST0001")):
    """[화면5] 내 포트폴리오 상태 요약"""
    data = db.get_portfolio_summary(customer_id)
    if not data:
        raise HTTPException(404, f"Customer {customer_id} not found")
    return data


@app.get("/api/holding-signals")
def get_holding_signals(
    customer_id: str = Query(default="CUST0001"),
    limit: int = Query(default=10, le=50)
):
    """[화면2] 지금 내 투자 상황 - 보유종목 시그널"""
    return {"holdings": db.get_holding_signals(customer_id, limit)}


@app.get("/api/unexpected-signals")
def get_unexpected_signals(limit: int = Query(default=4, le=10)):
    """[화면1] 지금 주목할만한 의외의 신호"""
    return {"signals": db.get_unexpected_signals(limit)}


@app.get("/api/market-events")
def get_market_events(limit: int = Query(default=5, le=20)):
    """[화면3] 지금 뜨는 이벤트·시황"""
    return {"events": db.get_market_events(limit)}



@app.get("/api/schedule-detail")
def get_schedule_detail(event_id: str = Query(...)):
    """일정 상세 팝업 데이터 (캐시 or FM 생성)"""
    data = db.get_schedule_detail(event_id)
    return data


@app.get("/api/market-overview")
def get_market_overview(segment: str = Query(default=None)):
    """[화면3] 시장 현황 브리핑"""
    return {"markets": db.get_market_overview(segment)}


@app.get("/api/schedules")
def get_schedules(limit: int = Query(default=10, le=30)):
    """[화면4] 다가오는 일정"""
    return {"schedules": db.get_schedules(limit)}


@app.get("/api/customer-alerts")
def get_customer_alerts(
    customer_id: str = Query(default=None),
    priority: str = Query(default=None)
):
    """고객 알림/인사이트"""
    return {"alerts": db.get_customer_alerts(customer_id, priority)}


@app.get("/api/situation-summary")
def get_situation_summary(customer_id: str = Query(default="CUST0010")):
    """홈 화면 AI 요약 문구 (고객별 개인화)"""
    data = db.get_situation_summary(customer_id)
    if not data.get('customer_name'):
        raise HTTPException(404, f"No summary found for {customer_id}")
    return data


@app.get("/api/top-investor")
def get_top_investor(limit: int = Query(default=4, le=20)):
    """[화면6] 고수들은 지금 이렇게 움직이고 있어요"""
    return {"investors": db.get_top_investors(limit)}





@app.get("/api/holding-detail")
def get_holding_detail(customer_id: str = Query(default="CUST0001"), asset_name: str = Query(...)):
    """종목 상세 팝업 데이터"""
    data = db.get_holding_detail(customer_id, asset_name)
    return data


@app.get("/api/event-detail")
def get_event_detail(event_id: str = Query(...)):
    """뉴스/이벤트 상세"""
    data = db.get_event_detail(event_id)
    if not data:
        raise HTTPException(404, f"Event {event_id} not found")
    return data


@app.get("/api/customer-interests")
def get_customer_interests(customer_id: str = Query(...)):
    """설정 > 관심종목 목록 (고객별)"""
    return {"interests": db.get_customer_interests(customer_id)}


# ===== Chat API (Genie Space) =====

class ChatRequest(BaseModel):
    question: str
    conversation_id: str | None = None
    customer_id: str | None = None
    customer_name: str | None = None
    segment: str | None = None  # 세그먼트 코드 (SEG01~SEG04)


@app.post("/api/chat")
def chat(req: ChatRequest):
    """AI PB 챗봇 - V2(LLM) 우선, 실패 시 V1(Genie) fallback"""
    if not req.customer_id:
        raise HTTPException(400, "customer_id는 필수입니다. 고객을 먼저 선택해주세요.")
    import logging
    import time
    from concurrent.futures import ThreadPoolExecutor

    logger = logging.getLogger("app")
    logger.info(f"[CHAT_API] customer_id={req.customer_id}, segment={req.segment}, question={req.question[:50]}")

    # ============ V2: LLM Markdown Composer (우선) ============
    try:
        from backend.llm_client import LLMClient
        from backend.intent_router import route
        from backend.data_fetcher import fetch_all_parallel
        from backend.markdown_composer import compose_markdown

        v2_start = time.time()
        llm = LLMClient()

        # Step 1+2 병렬: Intent Router + Data Fetch
        with ThreadPoolExecutor(max_workers=2) as executor:
            router_future = executor.submit(route, req.question, llm)
            data_future = executor.submit(fetch_all_parallel, req.customer_id, db)
            route_result = router_future.result()
            data = data_future.result()

        intent = route_result["intent"]
        confidence = route_result["confidence"]

        if intent != "fallback" and confidence >= 0.4:
            # Step 3: LLM이 자연스러운 마크다운 응답 생성
            markdown_response = compose_markdown(
                question=req.question,
                intent=intent,
                customer_name=req.customer_name or req.customer_id,
                segment=req.segment or "SEG01",
                data=data or {},
                llm=llm,
            )

            if markdown_response:
                v2_elapsed = time.time() - v2_start
                logger.info(f"[CHAT_V2] SUCCESS in {v2_elapsed:.2f}s, intent={intent}, {len(markdown_response)} chars")

                # 차트 데이터 추출 (diagnosis ratio 필드로 도넛 차트 생성)
                chart_sections = []
                diag = data.get("diagnosis", [{}])
                if diag:
                    row = diag[0] if isinstance(diag, list) and diag else diag
                    ratio_map = {
                        "주식": row.get("stock_ratio"),
                        "채권": row.get("bond_ratio"),
                        "ETF": row.get("etf_ratio"),
                        "펀드": row.get("fund_ratio"),
                        "파생상품": row.get("derivative_ratio"),
                        "현금": row.get("cash_ratio"),
                    }
                    chart_data = [{"name": k, "value": round(v * 100, 1)} for k, v in ratio_map.items() if v and v > 0]
                    if chart_data:
                        chart_sections.append({
                            "section_type": "chart_data",
                            "title": "자산 배분 현황",
                            "icon": "🥧",
                            "content": {"chart_type": "donut", "data": chart_data}
                        })

                return {
                    "status": "success",
                    "answer": markdown_response,
                    "sql": None,
                    "table_data": None,
                    "conversation_id": None,
                    "suggested_questions": [],
                    "structured": {
                        "intent": intent,
                        "intent_confidence": confidence,
                        "headline": "",
                        "summary": "",
                        "overall_status": {},
                        "sections": chart_sections,
                        "recommended_actions": [],
                        "disclaimer": "",
                    } if chart_sections else None,
                }
    except Exception as e:
        logger.warning(f"[CHAT_V2] Failed, falling back to V1: {e}")

    # ============ V1: Genie Space (fallback) ============
    from backend.intent_classifier import classify
    from backend.data_fetcher import fetch_supplemental

    early_intent = classify(question=req.question, sql=None, answer=None)
    intent_name = early_intent["intent"]
    is_lookup = intent_name in ("portfolio_allocation_summary", "holding_loss_detail", "holding_profit_detail")

    pre_fetched_extra = None
    with ThreadPoolExecutor(max_workers=2) as executor:
        genie_future = executor.submit(
            genie.ask, req.question, req.conversation_id,
            req.customer_id, req.customer_name, req.segment
        )
        supplemental_future = None
        if not is_lookup and intent_name != "fallback" and early_intent["confidence"] >= 0.4:
            supplemental_future = executor.submit(
                fetch_supplemental, intent_name, req.customer_id, db
            )
        genie_result = genie_future.result()
        if supplemental_future:
            try:
                pre_fetched_extra = supplemental_future.result()
            except Exception as e:
                logger.warning(f"[CHAT_API] Supplemental fetch failed: {e}")

    try:
        structured = build_structured_response(
            genie_result=genie_result,
            customer_id=req.customer_id,
            customer_name=req.customer_name,
            segment=req.segment,
            db=db,
            question=req.question,
            pre_fetched_extra=pre_fetched_extra,
        )
        if structured:
            genie_result["structured"] = structured
    except Exception as e:
        logger.warning(f"[CHAT_API] Structured response failed (fallback): {e}")

    return genie_result


# ===== Chat V2: LLM Orchestrator (Phase A PoC) =====

@app.post("/api/chat-v2")
def chat_v2(req: ChatRequest):
    """AI PB 챗봇 V2 — LLM Orchestrator (Genie 제거, 직접 SQL + LLM)"""
    if not req.customer_id:
        raise HTTPException(400, "customer_id는 필수입니다.")

    import logging
    import time
    from concurrent.futures import ThreadPoolExecutor
    from backend.llm_client import LLMClient
    from backend.intent_router import route
    from backend.response_composer import compose
    from backend.validator import validate
    from backend.data_fetcher import fetch_supplemental

    logger = logging.getLogger("app")
    start = time.time()

    llm = LLMClient()

    # Step 1+2 병렬: Intent Router + Data Fetch 동시 실행
    # Router(~1초) + 전체 테이블 병렬 조회(~1.5초) = max(1, 1.5) ≈ 1.5초
    from backend.data_fetcher import fetch_all_parallel

    with ThreadPoolExecutor(max_workers=2) as executor:
        router_future = executor.submit(route, req.question, llm)
        data_future = executor.submit(fetch_all_parallel, req.customer_id, db)

        route_result = router_future.result()
        data = data_future.result()

    intent = route_result["intent"]
    confidence = route_result["confidence"]

    logger.info(f"[V2] Intent: {intent} (conf={confidence:.2f})")

    # Fallback: 신뢰도 낮거나 fallback intent
    if intent == "fallback" or confidence < 0.4:
        return {"status": "fallback", "answer": "", "structured": None,
                "v2_meta": {"intent": intent, "confidence": confidence, "elapsed": time.time() - start}}

    if not data:
        data = {}

    # Step 3: LLM Response Composer (~3~5초)
    composed = compose(
        question=req.question,
        intent=intent,
        customer_name=req.customer_name or req.customer_id,
        segment=req.segment or "SEG01",
        data=data,
        llm=llm,
    )

    # Step 4: Validation
    if composed:
        validated = validate(composed, data)
    else:
        validated = None

    elapsed = time.time() - start
    logger.info(f"[V2] Total: {elapsed:.2f}s, sections={len(validated.get('sections', [])) if validated else 0}")

    if validated:
        # 성공: 구조화 응답
        return {
            "status": "success",
            "answer": validated.get("summary", ""),
            "structured": {
                "intent": intent,
                "intent_confidence": confidence,
                "customer_context": {
                    "customer_id": req.customer_id,
                    "customer_name": req.customer_name or req.customer_id,
                    "segment_code": req.segment,
                },
                "headline": validated.get("summary", ""),
                "summary": validated.get("summary", ""),
                "overall_status": validated.get("overall_status", {}),
                "sections": validated.get("sections", []),
                "recommended_actions": validated.get("recommended_actions", []),
                "disclaimer": validated.get("disclaimer", ""),
            },
            "v2_meta": {
                "intent": intent,
                "confidence": confidence,
                "elapsed": elapsed,
                "sections_count": len(validated.get("sections", [])),
            },
        }
    else:
        # LLM 실패: fallback
        return {"status": "fallback", "answer": "", "structured": None,
                "v2_meta": {"intent": intent, "confidence": confidence, "elapsed": elapsed, "error": "composition_failed"}}


# ===== React SPA Static Serving =====

DIST_DIR = Path("dist")

if DIST_DIR.exists():
    # Static assets (JS/CSS/images)
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="static")

    @app.get("/{path:path}")
    def serve_spa(path: str):
        """SPA fallback - 모든 non-API 경로를 index.html로 라우팅"""
        file = DIST_DIR / path
        if file.exists() and file.is_file():
            return FileResponse(file)
        return FileResponse(DIST_DIR / "index.html")
else:
    @app.get("/")
    def no_dist():
        return {"status": "running", "message": "API is active. Build frontend with 'npm run build' and place in dist/ folder."}
