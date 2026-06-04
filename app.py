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
        import traceback
        logger.warning(f"[CHAT_V2] Failed, falling back to V1: {e}\n{traceback.format_exc()}")
        # 임시: V2 실패 원인을 응답에 포함 (디버깅용)
        _v2_error = str(e)

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

    # V2 에러 정보 추가 (디버깅용)
    if '_v2_error' in dir():
        genie_result["_v2_debug"] = _v2_error
    return genie_result


# ===== Chat V2: LLM Orchestrator (Phase A PoC) =====

@app.post("/api/chat-v2")
def chat_v2(req: ChatRequest):
    """AI PB 챗봇 V2 — LLM Markdown Composer"""
    if not req.customer_id:
        raise HTTPException(400, "customer_id는 필수입니다.")

    import logging
    import time
    from concurrent.futures import ThreadPoolExecutor
    from backend.llm_client import LLMClient
    from backend.intent_router import route
    from backend.data_fetcher import fetch_all_parallel
    from backend.markdown_composer import compose_markdown

    logger = logging.getLogger("app")
    start = time.time()

    llm = LLMClient()

    # Step 1+2 병렬
    with ThreadPoolExecutor(max_workers=2) as executor:
        router_future = executor.submit(route, req.question, llm)
        data_future = executor.submit(fetch_all_parallel, req.customer_id, db)
        route_result = router_future.result()
        data = data_future.result()

    intent = route_result["intent"]
    confidence = route_result["confidence"]

    logger.info(f"[V2] Intent: {intent} (conf={confidence:.2f})")

    if intent == "fallback" or confidence < 0.4:
        return {"status": "fallback", "answer": "", "structured": None,
                "v2_meta": {"intent": intent, "confidence": confidence, "elapsed": time.time() - start}}

    # Step 3: LLM Markdown Composer
    markdown_response = compose_markdown(
        question=req.question,
        intent=intent,
        customer_name=req.customer_name or req.customer_id,
        segment=req.segment or "SEG01",
        data=data or {},
        llm=llm,
    )

    elapsed = time.time() - start

    if markdown_response:
        logger.info(f"[V2] SUCCESS in {elapsed:.2f}s, {len(markdown_response)} chars")

        # Intent별 차트 데이터 생성
        chart_sections = []
        diag = data.get("diagnosis", [])
        row = diag[0] if diag and isinstance(diag, list) and len(diag) > 0 else {}

        if intent == "portfolio_diagnosis":
            # 1) 도넛: 자산 배분
            ratio_map = {
                "국내주식": row.get("domestic_stock_ratio"),
                "해외주식": row.get("foreign_stock_ratio"),
                "ETF": row.get("etf_ratio"),
                "펀드": row.get("fund_ratio"),
                "채권": row.get("bond_ratio"),
                "파생상품": row.get("derivative_ratio"),
            }
            chart_items = [{"name": k, "value": round(float(v) * 100, 1)} for k, v in ratio_map.items() if v and float(v) > 0]
            if chart_items:
                chart_sections.append({
                    "section_type": "chart_data",
                    "title": "자산 배분 현황",
                    "icon": "🥧",
                    "content": {"chart_type": "donut", "data": chart_items}
                })

            # 2) 게이지: 포트폴리오 위험도
            risk_level = row.get("portfolio_risk_level", "")
            risk_scores = {"높음": 80, "중간": 50, "낮음": 20}
            risk_levels = {"높음": "warning", "중간": "caution", "낮음": "good"}
            if risk_level in risk_scores:
                chart_sections.append({
                    "section_type": "chart_data",
                    "title": "포트폴리오 위험 수준",
                    "icon": "🎯",
                    "content": {
                        "chart_type": "gauge",
                        "value": risk_scores[risk_level],
                        "max": 100,
                        "label": risk_level,
                        "level": risk_levels[risk_level],
                        "unit": "점",
                    }
                })

            # 3) 바: 위험 신호 분포
            signals = data.get("signals", [])
            if signals:
                from collections import Counter
                cats = Counter(s.get("signal_category", "기타") for s in signals if s.get("risk_notice_required"))
                if cats:
                    bar_data = [{"name": k, "value": v} for k, v in cats.most_common(5)]
                    chart_sections.append({
                        "section_type": "chart_data",
                        "title": "위험 신호 분포",
                        "icon": "⚠️",
                        "content": {"chart_type": "bar", "data": bar_data, "unit": "건"}
                    })

        elif intent == "rebalancing_recommendation":
            # 비교 차트: 현재 vs 목표
            if row:
                comparison = []
                stock = row.get("domestic_stock_ratio")
                deriv = row.get("derivative_ratio")
                etf = row.get("etf_ratio")
                if stock is not None:
                    comparison.append({"name": "주식", "current": round(float(stock) * 100, 1), "target": 75.0})
                if etf is not None:
                    comparison.append({"name": "ETF", "current": round(float(etf) * 100, 1), "target": 15.0})
                if deriv is not None:
                    comparison.append({"name": "파생상품", "current": round(float(deriv) * 100, 1), "target": 10.0})
                if comparison:
                    chart_sections.append({
                        "section_type": "chart_data",
                        "title": "현재 vs 목표 비중",
                        "icon": "🎯",
                        "content": {"chart_type": "comparison", "data": comparison}
                    })

                    # 꺾은선: 자산군별 현재→목표 변화
                    line_data = [{"name": c["name"], "value": c["current"], "value2": c["target"]} for c in comparison]
                    chart_sections.append({
                        "section_type": "chart_data",
                        "title": "비중 조정 방향",
                        "icon": "📈",
                        "content": {
                            "chart_type": "line",
                            "data": line_data,
                            "unit": "%",
                            "legend": [{"label": "현재", "color": "#606CF2"}, {"label": "목표", "color": "#10B981"}],
                        }
                    })

        elif intent in ("risk_alert", "holding_risk_check"):
            # 바: 종목별 위험 신호 수
            signals = data.get("signals", [])
            if signals:
                from collections import Counter
                asset_counts = Counter(s.get("asset_name", "?") for s in signals if s.get("risk_notice_required"))
                if asset_counts:
                    bar_data = [{"name": k[:8], "value": v} for k, v in asset_counts.most_common(6)]
                    chart_sections.append({
                        "section_type": "chart_data",
                        "title": "종목별 위험 신호",
                        "icon": "📊",
                        "content": {"chart_type": "bar", "data": bar_data, "unit": "건"}
                    })

            # 산점도: 종목별 비중 vs 신호 수
            if signals and row:
                scatter_data = []
                for asset, cnt in asset_counts.most_common(8):
                    # Try to find weight for this asset
                    weight_info = [s for s in signals if s.get("asset_name") == asset]
                    weight = 10  # default
                    if weight_info and weight_info[0].get("holding_weight"):
                        weight = round(float(weight_info[0]["holding_weight"]) * 100, 1)
                    scatter_data.append({"x": weight, "y": cnt, "name": asset[:6], "z": cnt * 20})
                if scatter_data:
                    chart_sections.append({
                        "section_type": "chart_data",
                        "title": "비중 vs 위험 신호",
                        "icon": "🔬",
                        "content": {
                            "chart_type": "scatter",
                            "data": scatter_data,
                            "xLabel": "보유 비중(%)",
                            "yLabel": "위험 신호(건)",
                            "xUnit": "%",
                            "yUnit": "건",
                        }
                    })

        elif intent == "market_context_analysis":
            # 도넛: 자산 배분 (시장 영향 맥락으로)
            ratio_map = {
                "주식": row.get("domestic_stock_ratio"),
                "ETF": row.get("etf_ratio"),
                "파생상품": row.get("derivative_ratio"),
            }
            chart_items = [{"name": k, "value": round(float(v) * 100, 1)} for k, v in ratio_map.items() if v and float(v) > 0]
            if chart_items:
                chart_sections.append({
                    "section_type": "chart_data",
                    "title": "시장 영향 받는 자산 비중",
                    "icon": "🌐",
                    "content": {"chart_type": "donut", "data": chart_items}
                })

        # Intent별 추천 질문
        _followups = {
            "portfolio_diagnosis": ["리밸런싱 어떻게 해야 돼?", "위험 종목만 따로 보여줘", "자산 배분 비중 알려줘"],
            "risk_alert": ["가장 위험한 종목은 뭐야?", "손절 기준 알려줘", "포트폴리오 전체 진단해줘"],
            "holding_risk_check": ["리스크 높은 종목 정리해줘", "포트폴리오 진단해줘", "리밸런싱 추천해줘"],
            "rebalancing_recommendation": ["지금 바로 실행할 건 뭐야?", "포트폴리오 진단해줘", "위험 신호 알려줘"],
            "portfolio_allocation_summary": ["비중 조정 필요한 거 있어?", "포트폴리오 진단해줘", "위험 종목 알려줘"],
            "holding_loss_detail": ["손절해야 할 종목 있어?", "전체 포트폴리오 진단해줘", "리밸런싱 추천해줘"],
            "holding_profit_detail": ["수익 실현할 종목 있어?", "포트폴리오 진단해줘", "리밸런싱 필요해?"],
        }

        # 마크다운에 차트 마커 삽입 (첫 번째 테이블 뒤에 차트 삽입)
        final_answer = markdown_response
        if chart_sections:
            # 첫 번째 테이블 끝 이후에 첫 차트 삽입
            lines = final_answer.split("\n")
            table_end_idx = -1
            for i, line in enumerate(lines):
                if line.startswith("|") and i > 0 and not lines[i-1].startswith("|") and table_end_idx == -1:
                    pass
                elif not line.startswith("|") and i > 0 and lines[i-1].startswith("|"):
                    table_end_idx = i
                    break

            if table_end_idx > 0 and len(chart_sections) >= 1:
                # 첫 테이블 뒤에 첫 차트
                lines.insert(table_end_idx, "\n{{CHART:0}}\n")
                # 두 번째 차트는 텍스트 중간쯤
                if len(chart_sections) >= 2:
                    # 전체의 70% 지점에 삽입
                    mid_idx = int(len(lines) * 0.7)
                    lines.insert(mid_idx, "\n{{CHART:1}}\n")
                final_answer = "\n".join(lines)
            else:
                # 테이블 못 찾으면 마지막에 차트 마커 추가
                for i in range(len(chart_sections)):
                    final_answer += f"\n\n{{{{CHART:{i}}}}}\n"

        return {
            "status": "success",
            "answer": final_answer,
            "structured": {
                "intent": intent,
                "headline": "",
                "summary": "",
                "overall_status": {},
                "sections": chart_sections,
                "recommended_actions": [],
                "disclaimer": "",
            } if chart_sections else None,
            "suggested_questions": _followups.get(intent, ["포트폴리오 진단해줘", "위험 종목 알려줘", "리밸런싱 추천해줘"]),
            "v2_meta": {"intent": intent, "confidence": confidence, "elapsed": elapsed},
        }
    else:
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
