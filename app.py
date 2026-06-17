"""
AI PB Databricks App - FastAPI Backend
React SPA 서빙 + App Cache 테이블 API + LLM 챗봇 API (V2)
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
import os

from backend.db_client import DBClient

app = FastAPI(title="AI PB App", docs_url="/docs")

# 클라이언트 초기화
db = DBClient()


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


# ── 의외의 신호 캐시 (홈 화면 ↔ 채팅 동일 결과 보장) ────────────────────
import time as _time_mod
_SIGNALS_CACHE: dict = {"data": None, "ts": 0.0}
_SIGNALS_TTL = 60  # 60초 TTL: 홈/채팅 동시 로드 시 동일 데이터

def _get_cached_signals(limit: int = 6) -> list:
    """TTL 캐시로 홈 화면과 채팅이 동일한 신호 목록 반환"""
    now = _time_mod.monotonic()
    if _SIGNALS_CACHE["data"] is None or (now - _SIGNALS_CACHE["ts"]) > _SIGNALS_TTL:
        _SIGNALS_CACHE["data"] = db.get_unexpected_signals(max(limit, 6))
        _SIGNALS_CACHE["ts"] = now
    return _SIGNALS_CACHE["data"][:limit]

@app.get("/api/unexpected-signals")
def get_unexpected_signals(limit: int = Query(default=4, le=10)):
    """[화면1] 의외의 신호 목록 (TTL 캐시 적용)"""
    return {"signals": _get_cached_signals(limit)}


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
def get_schedules(
    customer_id: str = Query(default="CUST0010"),
    limit: int = Query(default=10, le=30)
):
    """[화면4] 다가오는 일정 (고객 맞정)"""
    return {"schedules": db.get_schedules(customer_id, limit)}


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
    if not data.get('as_of_date'):
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
def get_event_detail(
    event_id: str = Query(...),
    customer_id: str = Query(default="CUST0010")
):
    """뉴스/이벤트 상세"""
    data = db.get_event_detail(event_id, customer_id)
    if not data:
        raise HTTPException(404, f"Event {event_id} not found")
    return data


@app.get("/api/customer-interests")
def get_customer_interests(customer_id: str = Query(...)):
    """설정 > 관심종목 목록 (고객별)"""
    return {"interests": db.get_customer_interests(customer_id)}



# ===== Disclaimer 추출 헬퍼 =====
_DISCLAIMER_PATTERNS = [
    "투자 의사결정은 본인 판단과 책임하에 진행해 주세요.",
    "참고용. 본인 판단 하에 실행.",
    "본 내용은 참고용이며 투자 판단은 본인 책임입니다.",
    "본 분석은 참고 인사이트입니다.",
]

def _extract_disclaimer(text: str) -> tuple:
    """본문에서 disclaimer 줄을 추출하고 (clean_text, disclaimer) 반환"""
    if not text:
        return text, ""
    for pattern in _DISCLAIMER_PATTERNS:
        if pattern in text:
            lines = text.splitlines()
            disc_lines = [l for l in lines if pattern in l]
            body_lines = [l for l in lines if pattern not in l]
            disclaimer = " ".join(disc_lines).strip()
            clean_text = "\n".join(body_lines).rstrip()
            return clean_text, disclaimer
    return text, ""

# ===== Chat API (Genie Space) =====

class ChatRequest(BaseModel):
    question: str
    conversation_id: str | None = None
    customer_id: str | None = None
    customer_name: str | None = None
    segment: str | None = None  # 세그먼트 코드 (SEG01~SEG04)
    conversation_history: list[str] = []  # 직전 대화 질문 목록 (최대 5건)


def generate_smart_followups(intent: str, data: dict, question: str, history: list) -> list:
    """실제 데이터(종목명/시그널) 주입 + 대화 히스토리 기반 중복 제거 팔로업 생성"""
    signals    = data.get("signals") or []
    holdings   = data.get("holdings") or []
    rebal_list = data.get("rebalancing") or []
    events     = (data.get("market_events") or data.get("events") or [])[:3]
    diagnosis  = data.get("diagnosis") or []
    diag  = diagnosis[0] if diagnosis else {}
    rebal = rebal_list[0] if rebal_list else {}

    # 위험 종목
    risk_assets = [s["asset_name"] for s in signals
                   if s.get("risk_notice_required") and s.get("asset_name")][:2]
    # 손실 종목 — float 안전 처리
    def _is_loss(s):
        try:
            return float(s.get("valuation_return_rate") or 0) < 0
        except (TypeError, ValueError):
            return False
    loss_assets = [s["asset_name"] for s in signals
                   if s.get("asset_name") and _is_loss(s)][:2]
    # 보유 종목
    held_assets = list(dict.fromkeys(
        [h["asset_name"] for h in holdings if h.get("asset_name")] +
        [s["asset_name"] for s in signals if s.get("asset_name")]
    ))[:3]
    # 리밸런싱 대상
    overweight_name = (rebal.get("overweight_assets") or "").split(",")[0].strip() or                       (held_assets[0] if held_assets else "")
    loss_cut_name   = (rebal.get("loss_cut_candidates") or "").split(",")[0].strip() or                       (loss_assets[0] if loss_assets else "")
    # 이벤트/섹터
    top_event_title  = (events[0].get("event_title") or "")[:20] if events else ""
    top_event_sector = (events[0].get("related_sector") or "") if events else ""
    top_sector = diag.get("top_concentrated_sector") or top_event_sector or ""

    def _a(lst, idx=0):
        return lst[idx] if len(lst) > idx else None

    TEMPLATES = {
        "portfolio_diagnosis": [
            f"{_a(risk_assets)} 왜 위험하다는 거야?" if risk_assets else None,
            f"{_a(held_assets)} 비중이 너무 높아?" if held_assets else None,
            f"{_a(loss_assets)} 손절해야 해?" if loss_assets else None,
            "리밸런싱 지금 해야 해?",
            f"{top_sector} 섹터 집중도 괜찮아?" if top_sector else None,
        ],
        "risk_alert": [
            f"{_a(risk_assets)} 구체적으로 뭐가 문제야?" if risk_assets else None,
            f"{_a(risk_assets, 1)} 도 위험해?" if _a(risk_assets, 1) else
            f"{_a(held_assets, 1)} 도 위험해?" if _a(held_assets, 1) else None,
            "지금 당장 팔아야 할 게 있어?",
            "포트폴리오 전체 진단해줘",
        ],
        "rebalancing_recommendation": [
            f"{overweight_name} 줄여야 해?" if overweight_name else None,
            f"{loss_cut_name} 손절 타이밍 맞아?" if loss_cut_name else None,
            "리밸런싱 후 어떻게 달라져?",
            "포트폴리오 진단해줘",
        ],
        "holding_risk_check": [
            f"{_a(risk_assets)} 이 신호 얼마나 심각해?" if risk_assets else None,
            "지금 당장 팔아야 할 게 있어?",
            "리밸런싱 추천해줘",
        ],
        "portfolio_allocation_summary": [
            f"{_a(held_assets)} 비중 조정해야 해?" if held_assets else None,
            "포트폴리오 진단해줘",
            "위험 종목 있어?",
        ],
        "holding_loss_detail": [
            f"{loss_cut_name} 손절해야 해?" if loss_cut_name else None,
            "전체 포트폴리오 진단해줘",
            "리밸런싱 추천해줘",
        ],
        "holding_profit_detail": [
            "수익 실현하면 어디에 재투자해?",
            "포트폴리오 진단해줘",
            "리밸런싱 필요해?",
        ],
        "market_context_analysis": [
            f"내 {_a(held_assets)} 이 시장 영향 받아?" if held_assets else "내 포트폴리오 영향 있어?",
            "위험 종목 알려줘",
            "리밸런싱 해야 해?",
        ],
        "news_disclosure_impact": [
            f"{top_event_sector} 관련 종목 더 있어?" if top_event_sector else "내 포트폴리오에 영향 있어?",
            "포트폴리오 진단해줘",
            "리밸런싱 해야 해?",
        ],
        "holding_asset_analysis": [
            f"{_a(held_assets)} 지금 매도 타이밍이야?" if held_assets else "매도해야 할 종목 있어?",
            "포트폴리오 진단해줘",
            "위험 신호 알려줘",
        ],
        "investment_change_summary": [
            f"{_a(held_assets)} 변동 더 자세히 봐줘" if held_assets else None,
            f"{_a(held_assets, 1)} 는 왜 바뀌었어?" if _a(held_assets, 1) else None,
            "전체 포트폴리오 진단해줘",
        ],
        "investment_change_detail": [
            f"{_a(held_assets)} 계속 보유해도 돼?" if held_assets else "계속 보유해도 돼?",
            "위험 신호 있어?",
            "포트폴리오 전체 진단해줘",
        ],
        "market_event_summary": [
            f"{top_event_title}... 내 종목 영향 있어?" if top_event_title else "내 포트폴리오 영향 있어?",
            f"{_a(held_assets)} 이 이벤트에 어떻게 영향 받아?" if held_assets else None,
            "포트폴리오 진단해줘",
        ],
        "market_event_detail": [
            f"{_a(held_assets)} 에 어떤 영향이야?" if held_assets else None,
            "관련 종목 더 보여줘",
            "포트폴리오 진단해줘",
        ],
        "upcoming_schedule_summary": [
            "일정 중 제일 중요한 거 뭐야?",
            f"{_a(held_assets)} 관련 일정 있어?" if held_assets else None,
            "포트폴리오 진단해줘",
        ],
        "upcoming_schedule_detail": [
            "이 일정 전에 대응해야 해?",
            "관련 종목 변동 알려줘",
            "포트폴리오 진단해줘",
        ],
        "theme_supply_demand": [
            f"{top_sector} 섹터 지금 사야 해?" if top_sector else None,
            f"{_a(held_assets)} 외국인 동향 어때?" if held_assets else "외국인 매매 동향 알려줘",
            "포트폴리오 진단해줘",
        ],
        "news_signal_summary": [
            f"{_a(held_assets)} 관련 뉴스 더 있어?" if held_assets else None,
            "포트폴리오에 영향 있는 뉴스야?",
            "포트폴리오 진단해줘",
        ],
        "news_signal_detail": [
            f"{_a(held_assets)} 계속 보유해도 돼?" if held_assets else None,
            "내 포트폴리오 영향 있어?",
            "위험 신호 알려줘",
        ],
        "expert_movement_detail": [
            "이 투자 유형 전략 따라가도 될까?",
            f"{_a(held_assets)} 포함돼 있어?" if held_assets else None,
            "포트폴리오 진단해줘",
        ],
        "expert_type_detail": [
            "이 유형 포트폴리오 내 꺼랑 비교해줘",
            f"{_a(held_assets)} 어떻게 평가해?" if held_assets else None,
            "리밸런싱 추천해줘",
        ],
    }

    DEFAULT = [
        f"{_a(held_assets)} 자세히 분석해줘" if held_assets else None,
        "포트폴리오 진단해줘",
        "위험 종목 알려줘",
        "리밸런싱 추천해줘",
    ]

    raw = [q for q in (TEMPLATES.get(intent) or DEFAULT) if q]

    # 대화 히스토리 기반 중복 제거
    all_asked = {question.strip()} | {h.strip() for h in (history or [])}

    def _similar(q: str) -> bool:
        q_l = q.lower()
        for asked in all_asked:
            a_l = asked.lower()
            if q_l == a_l:
                return True
            words = [w for w in q_l.split() if len(w) >= 2]
            if words and sum(1 for w in words if w in a_l) >= max(1, len(words) // 2):
                return True
        return False

    filtered = [q for q in raw if not _similar(q)]

    FALLBACKS = [
        f"{_a(held_assets)} 분석해줘" if held_assets else "포트폴리오 진단해줘",
        f"{_a(risk_assets)} 얼마나 위험해?" if risk_assets else "위험 종목 알려줘",
        "리밸런싱 필요해?",
        "오늘 시장 어때?",
    ]
    for fb in FALLBACKS:
        if len(filtered) >= 3:
            break
        if fb and not _similar(fb) and fb not in filtered:
            filtered.append(fb)

    return filtered[:3]


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
    from backend.data_fetcher import (
        fetch_all_parallel,
        build_investment_change_summary, build_investment_change_detail,
        build_market_event_summary, build_market_event_detail,
        build_upcoming_schedule_summary, build_upcoming_schedule_detail,
        build_expert_movement_detail,
        build_news_signal_summary, build_news_signal_detail,
    )
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
    # Post-routing 안전망: schedule 카테고리 키워드 → upcoming_schedule_detail 강제
    # 특정 이름이 아닌 카테고리 기반 → 어떤 일정이 추가되어도 자동 대응
    _SCHED_KW_POST = [
        'fomc','금리결정','연준','기준금리','cpi','ppi','gdp',
        '소비자물가','생산자물가','소비자심리','미시간대','실업률',
        '주주총회','주총','소집공고','임시주총','정기주총',
        '실적발표','증권발행실적','사업보고서','분기보고서','정기공시',
        'els','배당기준일','배당락',
    ]
    _DETAIL_KW_POST = ['알려줘','상세','보여줘','설명','에 대해','대해','뭐야','알려','어때','궁금','자세히']
    if (intent not in ('upcoming_schedule_detail','upcoming_schedule_summary')
            and any(k in req.question.lower() for k in _SCHED_KW_POST)
            and any(t in req.question for t in _DETAIL_KW_POST)):
        intent = "upcoming_schedule_detail"

    # Post-routing 안전망 2: 뉴스 카드 클릭 → news_signal_detail 강제
    # NewsSignalSummaryCard에서 클릭한 enriched_headline이 그대로 질문으로 들어오므로
    # 캐시된 뉴스 제목과 직접 매칭 → LLM 오분류(market_context 등) 방지
    if intent not in ('news_signal_detail', 'news_signal_summary'):
        _q_stripped = req.question
        for _sfx in [' 알려줘', ' 상세히 알려줘', ' 자세히 알려줘', ' 상세', ' 보여줘', ' 설명해줘']:
            if _q_stripped.endswith(_sfx):
                _q_stripped = _q_stripped[:-len(_sfx)].strip()
                break
        if 0 < len(_q_stripped) <= 60:
            _cached_news_check = _get_cached_signals(10)
            if _cached_news_check:
                _q_lower_check = _q_stripped.lower()
                _news_matched = next(
                    (n for n in _cached_news_check if _q_lower_check and
                     (n.get("enriched_headline") or "").lower() and  # 빈 headline 목록 방지 ("" in any_str == True 버그)
                     (
                        (n.get("enriched_headline") or "").lower() == _q_lower_check or
                        _q_lower_check in (n.get("enriched_headline") or "").lower() or
                        (n.get("enriched_headline") or "").lower() in _q_lower_check
                     )),
                    None
                )
                if _news_matched:
                    intent = "news_signal_detail"
                    logger.info(f"[V2] Post-routing: 뉴스 제목 매칭 → news_signal_detail ({_q_stripped[:30]})")

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
            "suggested_questions": generate_smart_followups("portfolio_diagnosis", data or {}, req.question, req.conversation_history),
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
                            "event_id": _ev.get("event_id"),
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

        # 주가 추이 차트: 추이/차트/흐름/주가/가격/종가/시세 키워드 감지
        _PRICE_CHART_KW = ["추이", "차트", "흐름", "주가", "가격", "종가", "시세"]
        if any(k in req.question for k in _PRICE_CHART_KW):
            from backend.data_fetcher import fetch_price_history
            # 1단계: 보유 종목에서 매칭 시도
            _all_assets = list(dict.fromkeys(
                [h.get("asset_name", "") for h in (data.get("holdings") or [])] +
                [s.get("asset_name", "") for s in (data.get("signals") or [])]
            ))
            _target_asset = next((a for a in _all_assets if a and a in req.question), "")
            
            # 2단계: 보유 종목에 없으면 질문에서 종목명 직접 추출 (daily_stock_price에서 검색)
            if not _target_asset:
                _known_stocks = ["삼성전자", "SK하이닉스", "네이버", "카카오", "현대차", "LG에너지솔루션",
                                 "삼성바이오로직스", "기아", "셀트리온", "POSCO홀딩스", "삼성SDI",
                                 "LG화학", "현대모비스", "KB금융", "신한지주", "하나금융지주",
                                 "엔씨소프트", "크래프톤", "두산에너빌리티", "한화에어로스페이스"]
                _target_asset = next((s for s in _known_stocks if s in req.question), "")
                
                # 3단계: 알려진 목록에도 없으면 2글자 이상 한글 명사 추출 시도
                if not _target_asset:
                    import re
                    _candidates = re.findall(r'[가-힣A-Z]{2,}(?:전자|하이닉스|소프트|바이오|에너지|금융|화학|증권)?', req.question)
                    # 키워드 제거
                    _exclude = set(_PRICE_CHART_KW + ["알려줘", "보여줘", "어때", "분석", "내"])
                    _candidates = [c for c in _candidates if c not in _exclude and len(c) >= 2]
                    _target_asset = _candidates[0] if _candidates else ""
            
            if _target_asset:
                _price_data = fetch_price_history(_target_asset, db, days=30)
                if _price_data and len(_price_data) >= 3:
                    chart_sections.insert(0, {
                        "section_type": "chart_data",
                        "title": f"{_target_asset} 최근 주가 추이",
                        "icon": "📈",
                        "content": {"chart_type": "line", "data": _price_data, "unit": "원"}
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
                _indices = []
                for m in _mkt[:4]:
                    _regime = m.get("market_regime", "")
                    _vol = m.get("avg_volatility")
                    _vol_str = f"변동성 {round(float(_vol) * 100, 1)}%" if _vol else ""
                    _indices.append({"name": str(m.get("market_segment", "")), "value": _regime, "change": _vol_str})
                _first = _mkt[0]
                if _first.get("VIX"):
                    _indices.append({"name": "VIX", "value": str(round(float(_first["VIX"]), 1)), "change": ""})
                if _first.get("VKOSPI"):
                    _indices.append({"name": "VKOSPI", "value": str(round(float(_first["VKOSPI"]), 1)), "change": ""})
                _regime_map = {"과열": "risk-on", "중립": "neutral", "침체": "risk-off"}
                _summary = _first.get("briefing_text") or "시장 데이터를 기반으로 분석했습니다."
                _risk = "warning" if _first.get("market_regime") == "과열" else "good" if _first.get("market_sentiment") == "긍정적" else "caution"
                chart_sections.append({
                    "section_type": "market_context_card",
                    "title": "시장 현황",
                    "icon": "📈",
                    "content": {
                        "market_summary": _summary,
                        "risk_level": _risk,
                        "indices": _indices,
                        "regime": _regime_map.get(_first.get("market_regime", ""), "neutral"),
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

        # %md 등 불필요한 마커 제거
        final_answer = final_answer.replace("\n%md", "").replace("%md", "").replace("% md", "").strip()

        # disclaimer 분리 (렌더링 순서 제어를 위해 별도 필드로)
        final_answer, _disclaimer = _extract_disclaimer(final_answer)
        # 투자 권유/제안 성격의 intent에만 disclaimer 표시
        # 단순 사실확인(general_financial_qna, fallback)에는 미표시
        _NO_DISCLAIMER_INTENTS = {"general_financial_qna", "fallback"}
        if not _disclaimer and intent not in _NO_DISCLAIMER_INTENTS:
            _disclaimer = "투자 의사결정은 본인 판단과 책임하에 진행해 주세요. ☺️ 궁금한 점은 언제든지 질문해 주세요." 

        # 스마트 팔로업 생성 (데이터 주입 + 히스토리 중복 제거)
        try:
            suggested = generate_smart_followups(intent, data or {}, req.question, req.conversation_history)
        except Exception as _fe:
            import logging as _log
            _log.getLogger(__name__).warning(f"[V2] generate_smart_followups failed: {_fe}")
            suggested = ["포트폴리오 진단해줘", "위험 종목 알려줘", "리밸런싱 추천해줘"]

        # ── Phase 2: card_type / card_data 생성 ─────────────────────────────────
        card_type = None
        card_data = None
        _q = req.question

        if intent == "investment_change_summary":
            card_type = "investment_change_summary"
            card_data = build_investment_change_summary(data, _q)
        elif intent == "investment_change_detail":
            # 질문에서 종목명 추출
            _asset = next((h.get("asset_name","") for h in (data.get("holdings") or []) if h.get("asset_name","") in _q), "")
            card_type = "investment_change_detail"
            # build_investment_change_detail 대신 get_holding_detail 직접 호출 (chart/masters/reasons 포함)
            if _asset:
                try:
                    card_data = db.get_holding_detail(req.customer_id, _asset)
                except Exception as _e:
                    logger.warning(f"[CHAT_V2] get_holding_detail failed: {_e}")
                    card_data = build_investment_change_detail(data, _asset)
            else:
                card_data = build_investment_change_detail(data, _asset)
        elif intent == "market_event_summary":
            card_type = "market_event_summary"
            card_data = build_market_event_summary(data, _q)
        elif intent == "market_event_detail":
            card_type = "market_event_detail"
            card_data = build_market_event_detail(data, _q)
        elif intent == "upcoming_schedule_summary":
            card_type = "upcoming_schedule_summary"
            card_data = build_upcoming_schedule_summary(data, _q)
        elif intent == "upcoming_schedule_detail":
            card_type = "upcoming_schedule_detail"
            # schedule_events에서 매칭된 이벤트 찾기
            _schedules = data.get("schedule_events", [])
            _q_lower = _q.lower()
            _matched = next(
                (s for s in _schedules if s.get("event_title", "").lower() and s.get("event_title", "").lower() in _q_lower),
                None
            )
            if not _matched:
                _q_words = [w for w in _q_lower.split() if len(w) >= 2]
                _best, _best_score = None, 0
                for _s in _schedules:
                    _score = sum(1 for w in _q_words if w in _s.get("event_title", "").lower())
                    if _score > _best_score:
                        _best, _best_score = _s, _score
                _matched = _best if _best and _best_score > 0 else (_schedules[0] if _schedules else {})
            # event_id로 enriched 데이터 조회
            _event_id = (_matched or {}).get("event_id")
            if _event_id:
                try:
                    _enriched = db.get_schedule_detail(_event_id)
                    _event_date = (_matched or {}).get("event_date")
                    _date_str = str(_event_date)[:10] if _event_date else ""
                    card_data = {
                        "d_tag": _enriched.get("tag") or (_matched or {}).get("d_tag", ""),
                        "date": _date_str,
                        "title": _enriched.get("title") or (_matched or {}).get("event_title", ""),
                        "summary": _enriched.get("summarySub", ""),
                        "ai_summary": _enriched.get("summary", ""),
                        "summary_icon": _enriched.get("summaryIcon", "🤖"),
                        "summary_label": _enriched.get("summaryLabel", "AI 이벤트 요약"),
                        "key_points": _enriched.get("reasons") or [],
                        "reasons_icon": _enriched.get("reasonsIcon", "🔥"),
                        "reasons_label": _enriched.get("reasonsLabel", "무슨 일이 일어날까?"),
                    }
                except Exception as _se:
                    logger.warning(f"[CHAT_V2] get_schedule_detail failed: {_se}")
                    card_data = build_upcoming_schedule_detail(data, _q)
            else:
                card_data = build_upcoming_schedule_detail(data, _q)
        elif intent in ("expert_movement_detail", "expert_type_detail"):
            card_type = intent
            # 유형 추출: "공격형", "장기형", "금상"
            _filter = next((t for t in ["공격형 투자", "장기형 투자", "금상"] if t in _q), None)
            card_data = build_expert_movement_detail(data, _filter or "")
        elif intent == "news_signal_summary":
            # 홈 화면과 동일한 데이터 소스·정렬 보장
            data["news_feed"] = _get_cached_signals(6)  # 홈 화면과 동일 TTL 캐시
            card_type = "news_signal_summary"
            card_data = build_news_signal_summary(data, _q)
        elif intent == "news_signal_detail":
            data["news_feed"] = _get_cached_signals(6)  # 홈 화면·요약 카드와 동일 TTL 캐시 사용
            card_type = "news_signal_detail"
            card_data = build_news_signal_detail(data, _q)

        return {
            "status": "success",
            "answer": final_answer,
            "disclaimer": _disclaimer,
            "structured": {
                "intent": intent,
                "headline": "",
                "summary": "",
                "overall_status": {},
                "sections": chart_sections,
                "recommended_actions": [],
                "disclaimer": "",
            } if chart_sections else None,
            "card_type": card_type,
            "card_data": card_data,
            "suggested_questions": suggested,
            "v2_meta": {"intent": intent, "confidence": confidence, "elapsed": elapsed},
        }
    else:
        customer_name = req.customer_name or req.customer_id
        return {
            "status": "success",
            "answer": f"{customer_name}님, 요청하신 내용을 분석하는 중 문제가 발생했어요. 다시 한번 질문해주시거나, 아래 추천 질문을 눌러보세요.",
            "structured": None,
            "suggested_questions": generate_smart_followups("portfolio_diagnosis", data or {}, req.question, req.conversation_history),
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
