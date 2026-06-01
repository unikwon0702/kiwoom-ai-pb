import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ChevronLeft, X, Send, Menu, Mic, User, TrendingUp, Shield, Activity, PieChart as PieIcon, BarChart3, Zap } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useCustomer } from "@/lib/customer-context";
// @ts-ignore
import ReactMarkdown from "react-markdown";
import {
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer
} from "recharts";

type ChatSearch = { autoPromptType?: string };

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    autoPromptType: (search.autoPromptType as string) || undefined,
  }),
  component: ChatPage,
});

/* ===== Types ===== */
type TableData = { columns: string[]; rows: (string | number | null)[][] };
type Msg =
  | { role: "user"; text: string }
  | { role: "bot"; text: string; description?: string; sql?: string | null; tableData?: TableData | null; isAnnouncement?: boolean; followUps?: string[] };

/* ===== Constants ===== */
const HISTORY_KEY = "aipb_chat_questions";
const COLORS = ["#606CF2", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6", "#6366F1", "#F97316"];
const GRADIENTS = [["#606CF2","#818CF8"],["#8B5CF6","#A78BFA"],["#06B6D4","#22D3EE"],["#10B981","#34D399"],["#F59E0B","#FBBF24"],["#EF4444","#FB7185"]];
/* Strip trailing follow-up / suggested question text from Genie answer */
function stripFollowUpText(text: string): string {
  // Remove trailing blocks like "Follow-up:", "추가로 궁금하신 점:", numbered suggestions, etc.
  return text
    .replace(/(\n\s*)(Follow-up|follow-up|후속 질문 추천|추가로 궁금하신 점|더 궁금하신 점|참고로)[:\s]*\n(\s*(\d+\.|-|•|\*)\s*.+\n?)+/gi, '')
    .replace(/(\n\s*)(추가로 궁금하신 점이나[^\n]*)/gi, '')
    .replace(/(\n\s*)(더 궁금하신 점이 있으시면[^\n]*)/gi, '')
    .replace(/(\n\s*)(궁금하신 점이 있으시면[^\n]*)/gi, '')
    .trim();
}

/* Clean up follow-up question: strip customer name prefix + shorten formal endings */
function cleanFollowUp(q: string, customerName: string): string {
  // Remove "XX님의 " prefix
  let cleaned = q.replace(new RegExp(`^${customerName}님의\\s*`, 'i'), '');
  cleaned = cleaned.replace(/^[A-Za-z\uAC00-\uD7A3]+님의\s*/, '');
  // Lowercase first char if Korean
  // Shorten formal endings: "알려주세요" → "알려줘", "보여주세요" → "보여줘", "해주세요" → "해줘"
  cleaned = cleaned.replace(/알려주세요\.?$/, '알려줘');
  cleaned = cleaned.replace(/보여주세요\.?$/, '보여줘');
  cleaned = cleaned.replace(/해주세요\.?$/, '해줘');
  cleaned = cleaned.replace(/확인해주세요\.?$/, '확인해줘');
  cleaned = cleaned.replace(/설명해주세요\.?$/, '설명해줘');
  cleaned = cleaned.replace(/분석해주세요\.?$/, '분석해줘');
  cleaned = cleaned.replace(/제안해주세요\.?$/, '제안해줘');
  cleaned = cleaned.replace(/\.\s*$/, '');
  return cleaned;
}

/* ===== Korean Labels ===== */
const COL_KR: Record<string, string> = {
  // 기본 자산 정보
  asset_name:"종목명", asset_type:"자산유형", asset_subtype:"세부유형",
  asset_korean_abbreviation:"종목 약칭", asset_category:"자산구분",
  sector:"섹터", market:"시장", country_code:"국가",
  // 금액/수량
  purchase_amount:"매수금액", buy_amount:"매수금액",
  valuation_amount:"평가금액", evaluation_amount:"평가금액",
  current_price:"현재가", latest_close_price:"종가",
  holding_amount:"보유금액", market_value:"시장가치",
  holding_current_price:"보유 현재가", average_buy_price:"평균매수가",
  quantity:"수량", holding_quantity:"보유수량",
  total_purchase_amount:"총매수금액", total_valuation_amount:"총평가금액",
  // 수익률/손익
  total_profit_loss:"총손익", profit_loss:"손익",
  total_return_rate:"총수익률", return_rate:"수익률", profit_loss_rate:"손익률",
  valuation_profit_loss_amount:"평가손익금액", valuation_return_rate:"평가수익률",
  current_return:"현재수익률", total_return_pct:"총수익률(%)",
  avg_return_rate:"평균수익률", max_return_rate:"최대수익률", min_return_rate:"최소수익률",
  price_change_rate:"가격변동률",
  top_asset_return:"상위종목 수익률", top_asset_name:"상위종목",
  best_return_asset_name:"최고수익 종목", worst_return_asset_name:"최저수익 종목",
  total_pnl:"총손익금액",
  // 비중/배분
  holding_weight:"비중", weight:"비중", max_holding_weight:"최대보유비중",
  stock_ratio:"주식", bond_ratio:"채권", cash_ratio:"현금", etf_ratio:"ETF",
  fund_ratio:"펀드", derivative_ratio:"파생상품", cash_like_ratio:"현금성",
  domestic_ratio:"국내", overseas_ratio:"해외", overseas_valuation_ratio:"해외평가비중",
  stock_weight:"주식비중", bond_weight:"채권비중", fund_weight:"펀드비중",
  derivative_weight:"파생비중", cash_weight:"현금비중",
  bond_fund_ratio:"채권펀드",
  // 리스크/진단 지표
  risk_score:"위험도", representative_risk_score:"대표 위험점수",
  product_risk_grade:"상품위험등급", portfolio_risk_level:"포트폴리오 위험등급",
  overall_diagnosis:"종합진단", concentration_score:"집중도",
  concentration_level:"집중도 수준", diversification_score:"분산투자 점수",
  volatility:"변동성", volatility_level:"변동성 수준",
  stock_volatility:"주식변동성", representative_volatility:"대표변동성",
  beta:"베타", sharpe_ratio:"샤프비율", fund_sharpe_ratio:"펀드 샤프비율",
  mdd:"최대하락폭(MDD)", fund_mdd:"펀드 MDD",
  rsi:"RSI", rsi_signal:"RSI 신호",
  per:"PER", pbr:"PBR", roe:"ROE",
  macd:"MACD", momentum_signal:"모멘텀 신호",
  valuation_signal:"벨류에이션 신호",
  cagr_1y:"1년 연평균성장률", trend_slope:"추세 기울기",
  news_sentiment:"뉴스 감성", avg_event_impact_score:"평균 이벤트영향도",
  max_event_impact_score:"최대 이벤트영향도",
  // 리밸런싱/전략
  rebalance_frequency:"리밸런싱 주기", risk_preference_summary:"위험선호 요약",
  portfolio_comment:"포트폴리오 코멘트", portfolio_theme:"포트폴리오 테마",
  // 보유 기간/건수
  holding_period_days:"보유일수", avg_holding_period_days:"평균보유일수",
  total_holding_count:"총보유종목수", stock_holding_count:"주식 보유수",
  etf_holding_count:"ETF 보유수", bond_holding_count:"채권 보유수",
  fund_holding_count:"펀드 보유수", derivative_holding_count:"파생 보유수",
  overseas_holding_count:"해외 보유수",
  loss_asset_count:"손실종목수", profit_asset_count:"수익종목수",
  // 시그널/이벤트
  total_signal_count:"총시그널수", risk_signal_count:"위험시그널수",
  signal_category_count:"시그널유형수", risk_signal_names:"위험신호명",
  has_risk_signal:"위험신호 여부", active_signal_count:"활성 시그널수",
  recent_event_count:"최근 이벤트수", positive_event_count:"긴정 이벤트",
  negative_event_count:"부정 이벤트", impacted_event_count:"영향 이벤트수",
  positive_impact_count:"긴정 영향", negative_impact_count:"부정 영향",
  neutral_impact_count:"중립 영향", avg_impact_score:"평균 영향도",
  // 채권/펀드/파생 지표
  ytm:"만기수익률(YTM)", duration:"듀레이션",
  modified_duration_value:"수정듀레이션", credit_rating:"신용등급",
  interest_rate_sensitivity:"금리민감도",
  period_return_6m:"6개월 수익률", bm_excess_return:"BM초과수익률",
  fund_flow_trend:"펀드자금흐름",
  knock_in_barrier:"녹인 배리어", knock_in_distance:"녹인 거리",
  early_redemption_probability:"조기상환 확률",
  maturity_remaining_days:"만기잔여일", derivative_total_return:"파생상품 총수익률",
  // 시장 상황
  latest_market_state:"시장상태", latest_market_regime:"시장국면",
  latest_market_comment:"시장코멘트", latest_market_date:"시장일자",
  // 고객 정보
  customer_name:"고객명", customer_id:"고객 ID",
  top_weight_asset_name:"최대비중 종목", top_weight_asset_sector:"최대비중 섹터",
  investor_risk_profile:"투자자 위험성향",
  // 기타
  signal_name:"시그널명", interpretation:"해석", signal_category:"시그널 분류",
  holding_type:"보유구분", as_of_date:"기준일",
};
function toKr(col: string): string { return COL_KR[col] || col.replace(/_/g, " "); }

/* ===== Formatters ===== */
function fmtVal(val: any): string {
  if (val === null || val === undefined || val === "") return "-";
  const n = Number(val);
  if (isNaN(n)) return String(val);
  if (Math.abs(n) >= 1e8) return `${(n/1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n/1e4).toLocaleString()}만`;
  if (Math.abs(n) < 100 && n !== 0 && String(val).includes(".")) return `${n.toFixed(2)}%`;
  return n.toLocaleString("ko-KR");
}

function loadHistory(): string[] {
  try { return JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

/* ===== Main Page ===== */
const AUTO_PROMPTS: Record<string, string> = {
  portfolio_diagnosis: "김기움님이 보유한 전체 종목 및 상품을 포트폴리오 관점에서 종합 진단을 해드릴게요.",
};

function ChatPage() {
  const { customer } = useCustomer();
  const { autoPromptType } = useSearch({ from: "/chat" });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [hasAutoPromptRun, setHasAutoPromptRun] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Auto-prompt: show AI announcement + call API without user bubble
  useEffect(() => {
    if (!autoPromptType || hasAutoPromptRun || !customer?.id) return;
    const promptText = AUTO_PROMPTS[autoPromptType];
    if (!promptText) return;
    setHasAutoPromptRun(true);
    const finalText = promptText.replace("김기움님", `${customer.name}님`);
    // Show as bot announcement (left white bubble), then call API silently
    setMessages(p => [...p, { role: "bot", text: finalText, isAnnouncement: true }]);
    sendAutoPrompt(finalText);
  }, [autoPromptType, hasAutoPromptRun, customer]);

  // Silent API call for auto-prompt (no user bubble added)
  const sendAutoPrompt = async (text: string) => {
    if (!customer?.id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, customer_id: customer.id, customer_name: customer.name, conversation_id: conversationId }),
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      const data = await res.json();
      setConversationId(data.conversation_id);
      let tableData: TableData | null = null;
      if (data.table_data) {
        const td = data.table_data;
        if (td.columns && td.rows) tableData = { columns: td.columns, rows: td.rows };
        else if (td.data_array && td.schema) tableData = { columns: td.schema.map((c: any) => c.name || c), rows: td.data_array };
      }
      const followUps: string[] = (data.suggested_questions?.slice(0, 3) || []).map((q: string) => cleanFollowUp(q, customer.name));
      setMessages(p => [...p, { role: "bot", text: stripFollowUpText(data.answer || "분석 완료"), description: data.description || "", sql: data.sql, tableData, followUps }]);
    } catch (e: any) {
      setMessages(p => [...p, { role: "bot", text: `오류: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  const sendQuestion = async (text: string) => {
    if (!customer?.id) { setMessages(p => [...p, { role: "bot", text: "고객을 먼저 선택해주세요." }]); return; }
    setMessages(p => [...p, { role: "user", text }]);
    setLoading(true);
    setHistory(p => { const n = [text, ...p.filter(q => q !== text)].slice(0, 30); try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(n)); } catch {} return n; });
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, customer_id: customer.id, customer_name: customer.name, conversation_id: conversationId }),
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      const data = await res.json();
      setConversationId(data.conversation_id);
      let tableData: TableData | null = null;
      if (data.table_data) {
        const td = data.table_data;
        if (td.columns && td.rows) tableData = { columns: td.columns, rows: td.rows };
        else if (td.data_array && td.schema) tableData = { columns: td.schema.map((c: any) => c.name || c), rows: td.data_array };
      }
      const followUps: string[] = (data.suggested_questions?.slice(0, 3) || []).map((q: string) => cleanFollowUp(q, customer.name));
      setMessages(p => [...p, { role: "bot", text: stripFollowUpText(data.answer || "분석 완료"), description: data.description || "", sql: data.sql, tableData, followUps }]);
    } catch (e: any) {
      setMessages(p => [...p, { role: "bot", text: `오류: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  const handleSend = () => { const t = input.trim(); if (!t) return; setInput(""); sendQuestion(t); };

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col bg-[#F5F6FA]">
        <header className="sticky top-0 z-10 rounded-b-2xl shadow-sm" style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}>
          <div className="flex items-center justify-between px-3 h-14">
            <Link to="/" className="size-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white"><ChevronLeft className="size-5" /></Link>
            <span className="text-[15px] font-bold text-white tracking-tight">AI PB 리포트</span>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setMenuOpen(true)} className="size-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white"><Menu className="size-5" /></button>
              <Link to="/" className="size-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white"><X className="size-5" /></Link>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 pb-3">
            <div className="size-6 rounded-full bg-white/20 flex items-center justify-center"><User className="size-3.5 text-white" /></div>
            <span className="text-[12px] text-white/90">{customer.name} 고객님 맞춤 분석</span>
          </div>
        </header>

        <HistoryPanel open={menuOpen} onClose={() => setMenuOpen(false)} history={history}
          onSelect={q => { setMenuOpen(false); sendQuestion(q); }}
          onClear={() => { setHistory([]); try { window.localStorage.removeItem(HISTORY_KEY); } catch {} }} />

        <main className="flex-1 px-4 pt-5 pb-4">
          {messages.length === 0 ? <EmptyState name={customer.name} onSend={sendQuestion} /> : (
            <div className="space-y-4">
              {messages.map((m, i) => m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[78%] rounded-2xl rounded-br-sm px-4 py-2.5 text-[14px] text-white shadow-sm" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>{m.text}</div>
                </div>
              ) : m.role === "bot" && m.isAnnouncement ? (
                <AnnouncementMessage key={i} text={m.text} />
              ) : <BotMessage key={i} msg={m} customerName={customer.name} />)}
              {loading && <LoadingPulse name={customer.name} />}
              {!loading && messages.length > 0 && messages[messages.length - 1].role === "bot" && !(messages[messages.length - 1] as any).isAnnouncement && ((messages[messages.length - 1] as any).followUps?.length > 0) && (
                <FollowUpQuestions
                  questions={(messages[messages.length - 1] as any).followUps}
                  onSelect={sendQuestion}
                />
              )}
              <div ref={endRef} />
            </div>
          )}
        </main>

        <div className="sticky bottom-0 px-4 pb-5 pt-3 bg-gradient-to-t from-[#F5F6FA] via-[#F5F6FA] to-transparent">
          <div className="rounded-2xl shadow-lg border border-gray-100 bg-white flex items-center gap-2 pl-3 pr-2 py-2">
            <button className="size-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50"><Mic className="size-[16px]" /></button>
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
              placeholder="AI PB에게 질문하세요" className="flex-1 bg-transparent text-[14px] text-gray-800 placeholder:text-gray-400 outline-none" />
            <button onClick={handleSend} className="size-8 rounded-full flex items-center justify-center text-white shadow-sm" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}><Send className="size-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Empty State ===== */
function EmptyState({ name, onSend }: { name: string; onSend: (q: string) => void }) {
  const suggestions = [
    { icon: "📊", text: "내 포트폴리오 종합 진단해줘" },
    { icon: "💰", text: "보유 종목별 수익률 알려줘" },
    { icon: "🎯", text: "내 자산 배분 현황 분석해줘" },
    { icon: "⚠️", text: "투자 리스크 점검해줘" },
  ];
  return (
    <div className="pt-2 space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-50">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
            <Zap className="size-5 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-800">AI 투자 진단</p>
            <p className="text-[12px] text-gray-400 mt-0.5">{name} 고객님 전용 리포트</p>
          </div>
        </div>
        <p className="text-[13px] text-gray-500 leading-relaxed">포트폴리오 분석, 종목 진단, 리스크 점검 등<br/>투자에 관한 질문을 해보세요.</p>
      </div>
      <div className="space-y-2">
        {suggestions.map(s => (
          <button key={s.text} onClick={() => onSend(s.text)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-gray-100 shadow-sm text-left hover:border-indigo-200 hover:shadow-md transition-all">
            <span className="text-[18px]">{s.icon}</span>
            <span className="text-[13.5px] text-gray-700 font-medium">{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ===== Announcement Message (auto-prompt intro) ===== */
function AnnouncementMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-start w-full">
      <div className="max-w-[85%] rounded-2xl bg-white border border-indigo-100 shadow-sm px-4 py-3.5">
        <div className="flex items-center gap-2 mb-2">
          <div className="size-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
            <Zap className="size-3 text-white" />
          </div>
          <span className="text-[12.5px] font-bold text-indigo-600">AI PB 진단 시작</span>
        </div>
        <p className="text-[13.5px] text-gray-600 leading-[1.6]">{text}</p>
      </div>
    </div>
  );
}

/* ===== Follow-Up Questions ===== */
function FollowUpQuestions({ questions, onSelect }: { questions: string[]; onSelect: (q: string) => void }) {
  return (
    <div className="w-full space-y-2">
      {questions.map((q) => (
        <button
          key={q}
          onClick={() => onSelect(q)}
          className="w-full flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[#F4F6FB] border border-[#E8ECF4] text-left hover:bg-[#EDF0F8] hover:border-indigo-200 transition-all"
        >
          <span className="text-[14px] text-indigo-400 mt-px shrink-0">↳</span>
          <span className="text-[13px] font-medium text-[#1E293B] leading-[1.5]">{q}</span>
        </button>
      ))}
    </div>
  );
}

/* ===== Loading ===== */
function LoadingPulse({ name }: { name: string }) {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="size-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="size-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="size-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-[13px] text-gray-500">{name}님 데이터 분석 중</span>
        </div>
      </div>
    </div>
  );
}

/* ===== Bot Message ===== */
function BotMessage({ msg, customerName }: { msg: Msg & { role: "bot" }; customerName: string }) {
  const charts = msg.tableData ? buildCharts(msg.tableData) : [];

  return (
    <div className="flex justify-start w-full">
      <div className="w-full space-y-3">
        {/* Main Answer Card with Markdown */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
                <Activity className="size-3.5 text-white" />
              </div>
              <span className="text-[13px] font-bold text-gray-800">{customerName}님 분석 결과</span>
            </div>
            {/* Genie description */}
            {msg.description && (
              <p className="text-[12px] text-indigo-500 mb-2 italic">{msg.description}</p>
            )}
            {msg.text && (
              <div className="text-[13.5px] text-gray-700 leading-[1.7]">
                <ReactMarkdown
                  components={{
                    strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                    ul: ({ children }) => <ul className="mt-2 space-y-1.5 list-none pl-0">{children}</ul>,
                    ol: ({ children }) => <ol className="mt-2 space-y-1.5 list-decimal pl-4">{children}</ol>,
                    li: ({ children }) => (
                      <li className="flex items-start gap-2">
                        <span className="size-1.5 rounded-full mt-[7px] shrink-0 bg-indigo-400" />
                        <span>{children}</span>
                      </li>
                    ),
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    table: ({ children }) => (
                      <div className="overflow-x-auto mt-2 mb-2 rounded-lg border border-gray-100">
                        <table className="w-full text-[12px]">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
                    th: ({ children }) => <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b border-gray-100">{children}</th>,
                    td: ({ children }) => <td className="px-2 py-1.5 text-gray-600 border-b border-gray-50">{children}</td>,
                    h1: ({ children }) => <h3 className="text-[14px] font-bold text-gray-900 mt-3 mb-1">{children}</h3>,
                    h2: ({ children }) => <h3 className="text-[14px] font-bold text-gray-900 mt-3 mb-1">{children}</h3>,
                    h3: ({ children }) => <h4 className="text-[13.5px] font-bold text-gray-800 mt-2 mb-1">{children}</h4>,
                    code: ({ children }) => <code className="text-[12px] bg-gray-100 px-1 py-0.5 rounded">{children}</code>,
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>
            )}
          </div>
          {/* First chart inside main card */}
          {charts.length > 0 && (
            <div className="px-4 pb-4 pt-1">
              {charts[0].type === "donut" ? <InlineDonut data={charts[0].data} /> : <InlineBar data={charts[0].data} />}
            </div>
          )}
        </div>

        {/* Additional charts */}
        {charts.slice(1).map((chart, i) => (
          <div key={i} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[14px]">{chart.type === "donut" ? "🎯" : "📊"}</span>
              <span className="text-[12px] font-bold text-gray-700">{chart.title}</span>
            </div>
            {chart.type === "donut" ? <InlineDonut data={chart.data} /> : <InlineBar data={chart.data} />}
          </div>
        ))}

        {/* Metric cards for single-row data */}
        {msg.tableData && msg.tableData.rows.length === 1 && msg.tableData.columns.length >= 2 && msg.tableData.columns.length <= 4 && charts.length === 0 && (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <div className="grid grid-cols-2 gap-3">
              {msg.tableData.columns.map((col, ci) => {
                const val = msg.tableData!.rows[0][ci];
                const n = Number(val);
                const isRate = col.includes("rate") || col.includes("ratio");
                return (
                  <div key={ci} className="rounded-xl p-3 bg-[#F8F9FF]">
                    <p className="text-[11px] text-gray-400 mb-0.5">{toKr(col)}</p>
                    <p className={`text-[17px] font-bold ${isRate && !isNaN(n) ? (n >= 0 ? "text-emerald-600" : "text-red-500") : "text-gray-800"}`}>
                      {isRate && !isNaN(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : fmtVal(val)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Inline Donut ===== */
function InlineDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const threshold = total * 0.03;
  const main = data.filter(d => d.value >= threshold);
  const others = data.filter(d => d.value < threshold);
  if (others.length > 0) main.push({ name: "기타", value: others.reduce((s, d) => s + d.value, 0) });

  return (
    <div className="flex items-center gap-4">
      <div className="w-[130px] h-[130px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={main} cx="50%" cy="50%" innerRadius={36} outerRadius={58}
              paddingAngle={2} dataKey="value" stroke="none">
              {main.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => `${((v/total)*100).toFixed(1)}%`}
              contentStyle={{ borderRadius: 10, fontSize: 11, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {main.slice(0, 6).map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-[11px] text-gray-600 truncate flex-1">{d.name}</span>
            <span className="text-[11px] font-bold text-gray-800 shrink-0">{total > 0 ? `${((d.value/total)*100).toFixed(0)}%` : fmtVal(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== Inline Horizontal Bar ===== */
function InlineBar({ data }: { data: { name: string; value: number }[] }) {
  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);
  return (
    <div className="space-y-2.5">
      {data.slice(0, 8).map((d, i) => {
        const pct = (Math.abs(d.value) / maxVal) * 100;
        const isNeg = d.value < 0;
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11.5px] text-gray-600 truncate max-w-[55%]">{d.name}</span>
              <span className={`text-[11.5px] font-bold ${isNeg ? "text-red-500" : "text-gray-800"}`}>{fmtVal(d.value)}</span>
            </div>
            <div className="h-[7px] rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{
                width: `${Math.min(pct, 100)}%`,
                background: isNeg ? "linear-gradient(90deg, #EF4444, #FB7185)" : `linear-gradient(90deg, ${GRADIENTS[i % GRADIENTS.length][0]}, ${GRADIENTS[i % GRADIENTS.length][1]})`
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===== Chart Building from Table Data ===== */
type ChartData = { type: "donut" | "hbar"; title: string; data: { name: string; value: number }[] };

function buildCharts(td: TableData): ChartData[] {
  if (!td.columns.length || !td.rows.length) return [];
  const numIdx = td.columns.map((_, ci) => ci).filter(ci => td.rows.some(r => { const v = r[ci]; return v !== null && v !== "" && !isNaN(Number(v)); }));
  const strIdx = td.columns.map((_, ci) => ci).filter(ci => td.rows.some(r => typeof r[ci] === "string" && isNaN(Number(r[ci]))));
  if (numIdx.length === 0) return [];
  const labelIdx = strIdx[0] ?? 0;
  const charts: ChartData[] = [];
  const isRatio = td.columns.some(c => c.includes("ratio") || c.includes("weight") || c.includes("비중"));

  if (td.rows.length === 1 && numIdx.length >= 3 && isRatio) {
    const data = numIdx.map(ci => ({ name: toKr(td.columns[ci]), value: Math.abs(Number(td.rows[0][ci]) || 0) })).filter(d => d.value > 0);
    if (data.length >= 2) charts.push({ type: "donut", title: "자산 배분 구성", data });
    return charts;
  }

  if (td.rows.length > 1) {
    const v1Idx = numIdx[0];
    const col1 = td.columns[v1Idx];
    const data1 = td.rows.slice(0, 10).map(r => ({ name: String(r[labelIdx] ?? "") || "-", value: Number(r[v1Idx]) || 0 })).filter(d => d.value !== 0 || td.rows.length <= 5);
    if (data1.length >= 2) {
      if (isRatio || col1.includes("weight") || col1.includes("ratio")) {
        charts.push({ type: "donut", title: toKr(col1) + " 구성", data: data1.map(d => ({ ...d, value: Math.abs(d.value) })) });
      } else {
        charts.push({ type: "hbar", title: toKr(col1) + " 비교", data: data1 });
      }
    }
    if (numIdx.length >= 2) {
      const v2Idx = numIdx[1];
      const col2 = td.columns[v2Idx];
      const data2 = td.rows.slice(0, 8).map(r => ({ name: String(r[labelIdx] ?? "") || "-", value: Number(r[v2Idx]) || 0 })).filter(d => d.value !== 0);
      if (data2.length >= 2) {
        const isR2 = col2.includes("ratio") || col2.includes("weight") || col2.includes("rate");
        charts.push({ type: isR2 ? "donut" : "hbar", title: toKr(col2), data: data2.map(d => ({ ...d, value: Math.abs(d.value) })) });
      }
    }
  }
  return charts;
}

/* ===== Answer Parsing ===== */
function parseAnswer(text: string): { summary: string; details: { title: string; items: string[] }[] } {
  if (!text) return { summary: "", details: [] };
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let summary = "";
  const details: { title: string; items: string[] }[] = [];
  let cur: { title: string; items: string[] } | null = null;

  for (const line of lines) {
    const hdr = line.match(/^\*\*(.+?)\*\*:?\s*$/) || line.match(/^#{1,3}\s+(.+)/) || line.match(/^\[(.+?)\]\s*$/);
    if (hdr) { if (cur && cur.items.length) details.push(cur); cur = { title: hdr[1].replace(/\*\*/g, "").trim(), items: [] }; continue; }
    const bullet = line.match(/^[-•*]\s*\*?\*?(.+?)\*?\*?$/);
    if (bullet && cur) { cur.items.push(bullet[1].replace(/\*\*/g, "").trim()); continue; }
    if (!cur) { summary += (summary ? "\n" : "") + line.replace(/\*\*/g, ""); }
    else { cur.items.push(line.replace(/\*\*/g, "")); }
  }
  if (cur && cur.items.length) details.push(cur);
  return { summary, details };
}

/* ===== Section Style ===== */
function getSectionStyle(title: string): { bg: string; icon: React.ReactNode } {
  if (title.includes("리스크") || title.includes("위험") || title.includes("진단"))
    return { bg: "#FEF2F2", icon: <Shield className="size-3.5 text-red-500" /> };
  if (title.includes("수익") || title.includes("성과"))
    return { bg: "#F0FDF4", icon: <TrendingUp className="size-3.5 text-emerald-500" /> };
  if (title.includes("배분") || title.includes("비중") || title.includes("구성"))
    return { bg: "#EFF6FF", icon: <PieIcon className="size-3.5 text-blue-500" /> };
  if (title.includes("추천") || title.includes("제안"))
    return { bg: "#FDF4FF", icon: <Zap className="size-3.5 text-purple-500" /> };
  return { bg: "#F5F3FF", icon: <BarChart3 className="size-3.5 text-indigo-500" /> };
}

/* ===== History Panel ===== */
function HistoryPanel({ open, onClose, history, onSelect, onClear }: {
  open: boolean; onClose: () => void; history: string[]; onSelect: (q: string) => void; onClear: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <aside className="absolute right-0 top-0 h-full w-[80%] max-w-[340px] bg-white shadow-2xl flex flex-col rounded-l-2xl">
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-50">
          <h2 className="text-[14px] font-bold text-gray-800">최근 질문</h2>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-full hover:bg-gray-50"><X className="size-4 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {history.length === 0 ? (
            <p className="py-8 text-[13px] text-gray-400 text-center">질문 내역이 없습니다</p>
          ) : (
            <div className="space-y-1">{history.map((q, i) => (
              <button key={`${q}-${i}`} onClick={() => onSelect(q)} className="w-full text-left px-3 py-2.5 rounded-xl text-[13px] text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">{q}</button>
            ))}</div>
          )}
        </div>
        {history.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-50">
            <button onClick={onClear} className="w-full text-[12px] text-gray-400 hover:text-red-400 py-2">전체 삭제</button>
          </div>
        )}
      </aside>
    </div>
  );
}
