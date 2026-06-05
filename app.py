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
def get_market_events(
    customer_id: str = Query(default="CUST0010"),
    limit: int = Query(default=5, le=20)
):
    """[화면3] 지금 뜨는 이벤트·시황 (고객 맞춤)"""
    return {"events": db.get_market_events(customer_id, limit)}



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

                # ===== UI Block Sections (홈 화면 카드 인라인 재사용) =====
                from backend.data_fetcher import fetch_all_parallel as _fetch

                # 뉴스/이벤트 카드 (news_disclosure_impact)
                if intent in ("news_disclosure_impact", "theme_supply_demand"):
                    events = data.get("events", data.get("news", []))
                    if isinstance(events, list):
                        for ev in events[:2]:
                            impacted = []
                            try:
                                import json as _json
                                impacted_raw = ev.get("impacted_assets_json", "[]")
                                if isinstance(impacted_raw, str):
                                    impacted = _json.loads(impacted_raw)
                            except Exception:
                                pass
                            chart_sections.append({
                                "section_type": "event_card",
                                "title": ev.get("event_title", "이벤트"),
                                "icon": "📰",
                                "content": {
                                    "event_title": ev.get("event_title", ""),
                                    "event_type": ev.get("event_type"),
                                    "related_sector": ev.get("related_sector"),
                                    "ai_investment_view": ev.get("ai_investment_view"),
                                    "sentiment_score": ev.get("sentiment_score"),
                                    "published_at": ev.get("published_at"),
                                    "impacted_assets": [{
                                        "asset_name": a.get("asset_name", ""),
                                        "impact_direction": a.get("impact_direction", "중립"),
                                        "short_reason": a.get("short_reason", ""),
                                    } for a in (impacted[:4] if impacted else [])],
                                }
                            })

                # 보유종목 카드 (holding_asset_analysis)
                if intent in ("holding_asset_analysis", "holding_loss_detail", "holding_profit_detail"):
                    holdings = data.get("holdings", [])
                    if isinstance(holdings, list):
                        for h in holdings[:3]:
                            chart_sections.append({
                                "section_type": "holding_card",
                                "title": h.get("asset_name", "종목"),
                                "icon": "📊",
                                "content": {
                                    "asset_name": h.get("asset_name", ""),
                                    "holding_type": h.get("holding_type", "보유"),
                                    "signal_name": h.get("signal_name"),
                                    "interpretation": h.get("interpretation"),
                                    "return_rate": h.get("return_rate") or h.get("valuation_return_rate"),
                                    "valuation": h.get("valuation_amount"),
                                    "weight": h.get("holding_weight"),
                                    "risk_level": "warning" if h.get("risk_notice_required") else "caution" if h.get("signal_category") == "위험" else "good",
                                }
                            })

                # 위험 알림 카드 (risk_alert)
                if intent in ("risk_alert", "holding_risk_check"):
                    signals = data.get("signals", data.get("holdings", []))
                    if isinstance(signals, list):
                        risk_items = []
                        for s in signals:
                            if s.get("risk_notice_required") or s.get("signal_category") == "위험":
                                risk_items.append({
                                    "level": "warning" if s.get("risk_notice_required") else "caution",
                                    "title": f"{s.get('asset_name', '')} {s.get('signal_name', '')}",
                                    "detail": s.get("interpretation", ""),
                                    "asset_name": s.get("asset_name"),
                                })
                        if risk_items:
                            chart_sections.append({
                                "section_type": "risk_alert_card",
                                "title": "위험 신호",
                                "icon": "⚠️",
                                "content": {
                                    "risk_items": risk_items[:5],
                                    "overall_risk_level": "warning" if any(r["level"] == "warning" for r in risk_items) else "caution",
                                }
                            })

                # 시장 상황 카드 (market_context_analysis)
                if intent == "market_context_analysis":
                    market = data.get("market", data.get("market_overview", []))
                    if isinstance(market, list) and market:
                        indices = [{
                            "name": m.get("market_segment", m.get("index_name", "")),
                            "value": m.get("representative_price", m.get("value", "")),
                            "change": m.get("daily_change_rate", m.get("change", "")),
                        } for m in market[:6]]
                        chart_sections.append({
                            "section_type": "market_context_card",
                            "title": "시장 현황",
                            "icon": "📈",
                            "content": {
                                "market_summary": data.get("market_comment", "시장 데이터를 기반으로 분석했습니다."),
                                "risk_level": data.get("market_risk_level", "caution"),
                                "indices": indices,
                                "regime": data.get("market_regime"),
                            }
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
        # V1 fallback 대신 LLM으로 정중한 거절 응답 생성
        customer_name = req.customer_name or req.customer_id
        decline_msg = llm._call(
            model=os.environ.get("LLM_COMPOSER_MODEL", "databricks-gpt-5-4-mini"),
            system_prompt="당신은 AI PB 어시스턴트입니다. 고객의 질문에 답변하기 어려운 경우, 정중하게 답변 범위를 안내합니다. 2~3문장으로 짧게 답변하세요. 이모지는 최소한으로 사용하세요.",
            user_prompt=f"고객명: {customer_name}\n질문: {req.question}\n\n이 질문은 포트폴리오 분석, 위험 진단, 리밸런싱, 시장 상황 분석 범위를 벗어납니다. 정중하게 답변 가능한 범위를 안내하고, 대신 도움이 될 만한 질문을 제안해주세요.",
            max_tokens=300,
            temperature=0.7,
            timeout=5.0,
            parse_json=False,
        )
        if not decline_msg:
            decline_msg = f"{customer_name}님, 해당 질문은 현재 AI PB가 분석할 수 있는 범위(포트폴리오 진단, 위험 분석, 리밸런싱, 시장 상황)를 벗어나는 것 같아요. 궁금하신 포트폴리오 현황이나 점검 포인트를 안내해드릴게요."
        return {
            "status": "success",
            "answer": decline_msg,
            "structured": None,
            "suggested_questions": ["내 포트폴리오 종합 진단해줘", "위험 종목 알려줘", "리밸런싱 추천해줘"],
            "v2_meta": {"intent": "decline", "confidence": confidence, "elapsed": time.time() - start},
        }

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
                    bar_data = [{"name": k if len(k) <= 12 else k[:10] + "…", "value": v} for k, v in asset_counts.most_common(6)]
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
                    scatter_data.append({"x": weight, "y": cnt, "name": asset if len(asset) <= 10 else asset[:8] + "…", "z": cnt * 20})
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
        # ===== 인라인 카드 Sections =====
        import json as _json

        if intent in ("news_disclosure_impact", "theme_supply_demand", "market_context_analysis"):
            _events = data.get("events", [])
            if isinstance(_events, list) and _events:
                for _ev in _events[:2]:
                    _impacted = []
                    try:
                        _imp_raw = _ev.get("impacted_assets_json") or "[]"
                        if isinstance(_imp_raw, str) and _imp_raw.strip():
                            _impacted = _json.loads(_imp_raw)
                    except Exception:
                        pass
                    chart_sections.append({
                        "section_type": "event_card",
                        "title": _ev.get("event_title", "이벤트"),
                        "icon": "📰",
                        "content": {
                            "event_title": _ev.get("event_title", ""),
                            "event_type": _ev.get("event_type"),
                            "related_sector": _ev.get("related_sector"),
                            "ai_investment_view": _ev.get("ai_investment_view"),
                            "sentiment_score": float(_ev["sentiment_score"]) if _ev.get("sentiment_score") else None,
                            "published_at": str(_ev.get("published_at", "")),
                            "impacted_assets": [{
                                "asset_name": a.get("asset_name", ""),
                                "impact_direction": a.get("impact_direction", "중립"),
                                "short_reason": a.get("short_reason", ""),
                            } for a in (_impacted[:4] if _impacted else [])],
                        }
                    })

        if intent in ("holding_asset_analysis", "holding_loss_detail", "holding_profit_detail"):
            _holds = data.get("holdings", data.get("signals", []))
            if isinstance(_holds, list) and _holds:
                for _h in _holds[:3]:
                    chart_sections.append({
                        "section_type": "holding_card",
                        "title": _h.get("asset_name", "종목"),
                        "icon": "📊",
                        "content": {
                            "asset_name": _h.get("asset_name", ""),
                            "holding_type": _h.get("holding_type", "보유"),
                            "signal_name": _h.get("signal_name"),
                            "interpretation": _h.get("interpretation") or _h.get("signal_interpretation"),
                            "return_rate": _h.get("return_rate") or _h.get("valuation_return_rate"),
                            "valuation": _h.get("valuation_amount"),
                            "weight": _h.get("holding_weight"),
                            "risk_level": "warning" if _h.get("risk_notice_required") else "caution" if _h.get("signal_category") == "위험" else "good",
                        }
                    })

        if intent in ("risk_alert", "holding_risk_check"):
            _sigs = data.get("signals", [])
            if isinstance(_sigs, list) and _sigs:
                _risk_items = []
                for _s in _sigs:
                    if _s.get("risk_notice_required") or _s.get("signal_category") == "위험":
                        _risk_items.append({
                            "level": "warning" if _s.get("risk_notice_required") else "caution",
                            "title": f"{_s.get('asset_name', '')} {_s.get('signal_name', '')}",
                            "detail": _s.get("signal_interpretation", ""),
                            "asset_name": _s.get("asset_name"),
                        })
                if _risk_items:
                    chart_sections.append({
                        "section_type": "risk_alert_card",
                        "title": "위험 신호",
                        "icon": "⚠️",
                        "content": {
                            "risk_items": _risk_items[:5],
                            "overall_risk_level": "warning" if any(r["level"] == "warning" for r in _risk_items) else "caution",
                        }
                    })

        if intent == "market_context_analysis":
            _mkt = data.get("market_overview", [])
            if isinstance(_mkt, list) and _mkt:
                _indices = [{
                    "name": str(m.get("market_segment", "")),
                    "value": str(m.get("representative_price", "")),
                    "change": str(m.get("daily_change_rate", "")),
                } for m in _mkt[:6]]
                chart_sections.append({
                    "section_type": "market_context_card",
                    "title": "시장 현황",
                    "icon": "📈",
                    "content": {
                        "market_summary": "시장 데이터를 기반으로 분석했습니다.",
                        "risk_level": "caution",
                        "indices": _indices,
                    }
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
            "news_disclosure_impact": ["내 포트폴리오에 영향 있어?", "위험 종목 알려줘", "리밸런싱 해야 해?"],
            "theme_supply_demand": ["외국인 매매 동향 알려줘", "포트폴리오 진단해줘", "위험 종목 있어?"],
            "holding_asset_analysis": ["이 종목 매도해야 해?", "포트폴리오 진단해줘", "위험 신호 알려줘"],
            "market_context_analysis": ["내 포트폴리오 영향 있어?", "위험 종목 알려줘", "리밸런싱 해야 해?"],
        }

        # 마크다운에 차트 마커 삽입 (테이블 뒤에 각각 삽입)
        final_answer = markdown_response
        if chart_sections:
            lines = final_answer.split("\n")

            # 모든 테이블 끝 위치 찾기
            table_ends = []
            for i, line in enumerate(lines):
                if not line.startswith("|") and i > 0 and lines[i-1].startswith("|"):
                    table_ends.append(i)

            if table_ends:
                # 각 차트를 테이블 뒤에 순서대로 삽입 (역순으로 삽입해야 인덱스 안 밀림)
                insertions = []
                for chart_idx in range(len(chart_sections)):
                    if chart_idx < len(table_ends):
                        insertions.append((table_ends[chart_idx], chart_idx))
                    else:
                        # 남은 차트는 마지막 테이블 뒤에
                        insertions.append((table_ends[-1], chart_idx))

                # 역순으로 삽입 (인덱스 밀림 방지)
                for pos, chart_idx in sorted(insertions, reverse=True):
                    lines.insert(pos, f"\n{{{{CHART:{chart_idx}}}}}\n")
                final_answer = "\n".join(lines)
            else:
                # 테이블 없으면 본문 끝에 차트 추가
                for i in range(len(chart_sections)):
                    final_answer += f"\n\n{{{{CHART:{i}}}}}\n"

        # 이미 한 질문은 추천에서 제외
        raw_suggestions = _followups.get(intent, ["포트폴리오 진단해줘", "위험 종목 알려줘", "리밸런싱 추천해줘"])
        user_q = req.question.strip()
        suggested = [q for q in raw_suggestions if q != user_q and q not in user_q and user_q not in q]
        # 3개 미만이면 기본 질문에서 보충
        _defaults = ["포트폴리오 진단해줘", "위험 종목 알려줘", "리밸런싱 추천해줘"]
        for d in _defaults:
            if len(suggested) >= 3:
                break
            if d not in suggested and d != user_q and d not in user_q and user_q not in d:
                suggested.append(d)

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
            "suggested_questions": suggested[:3],
            "v2_meta": {"intent": intent, "confidence": confidence, "elapsed": elapsed},
        }
    else:
        customer_name = req.customer_name or req.customer_id
        return {
            "status": "success",
            "answer": f"{customer_name}님, 요청하신 내용을 분석하는 중 문제가 발생했어요. 다시 한번 질문해주시거나, 아래 추천 질문을 눌러보세요.",
            "structured": None,
            "suggested_questions": ["내 포트폴리오 종합 진단해줘", "위험 종목 알려줘", "리밸런싱 추천해줘"],
            "v2_meta": {"intent": intent, "confidence": confidence, "elapsed": elapsed, "error": "composition_failed"},
        }


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
