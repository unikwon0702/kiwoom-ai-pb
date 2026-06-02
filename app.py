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
    """AI PB 챗봇 - Genie Space 대화 (고객 세그먼트별 맞춤 응답 + 구조화 카드 UI)"""
    if not req.customer_id:
        raise HTTPException(400, "customer_id는 필수입니다. 고객을 먼저 선택해주세요.")
    import logging
    logger = logging.getLogger("app")
    logger.info(f"[CHAT_API] customer_id={req.customer_id}, segment={req.segment}, question={req.question[:50]}")

    # Genie 호출 (기존 로직)
    genie_result = genie.ask(
        question=req.question,
        conversation_id=req.conversation_id,
        customer_id=req.customer_id,
        customer_name=req.customer_name,
        segment=req.segment,
    )

    # 구조화 응답 시도 (실패 시 None → 기존 방식 유지)
    try:
        structured = build_structured_response(
            genie_result=genie_result,
            customer_id=req.customer_id,
            customer_name=req.customer_name,
            segment=req.segment,
            db=db,
            question=req.question,
        )
        if structured:
            genie_result["structured"] = structured
    except Exception as e:
        logger.warning(f"[CHAT_API] Structured response failed (fallback): {e}")

    return genie_result


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
