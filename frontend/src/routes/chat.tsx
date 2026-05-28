import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, X, Send, Menu, Mic, User, TrendingUp, TrendingDown, Shield, Activity, PieChart as PieIcon, BarChart3, Info, Zap } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useCustomer } from "@/lib/customer-context";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

/* ===== Types ===== */
type TableData = { columns: string[]; rows: (string | number | null)[][] };
type Msg =
  | { role: "user"; text: string }
  | { role: "bot"; text: string; sql?: string | null; tableData?: TableData | null };

/* ===== Constants ===== */
const HISTORY_KEY = "aipb_chat_questions";
const CHART_COLORS = ["#606CF2", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6"];
const GRADIENT_COLORS = [
  ["#606CF2", "#818CF8"],
  ["#8B5CF6", "#A78BFA"],
  ["#06B6D4", "#22D3EE"],
  ["#10B981", "#34D399"],
  ["#F59E0B", "#FBBF24"],
];

/* ===== Korean Column Labels ===== */
const COL_KR: Record<string, string> = {
  total_profit_loss: "총손익", evaluation_amount: "평가금액", valuation_amount: "평가금액",
  stock_ratio: "주식 비중", bond_ratio: "채권 비중", cash_ratio: "현금 비중",
  risk_score: "위험도", negative_impact: "부정 영향", positive_impact: "긍정 영향",
  asset_name: "종목명", asset_type: "자산유형", holding_weight: "비중(%)",
  total_return_rate: "총수익률", customer_name: "고객명", age_group: "연령대",
  investment_style: "투자성향", total_asset_value: "총자산", sector: "섹터",
  profit_loss_rate: "손익률", purchase_amount: "매수금액", current_price: "현재가",
  quantity: "수량", avg_buy_price: "평균매수가", return_rate: "수익률",
  market_value: "시장가치", weight: "비중", domestic_ratio: "국내 비중",
  overseas_ratio: "해외 비중", etf_ratio: "ETF 비중", bond_fund_ratio: "채권펀드 비중",
  holding_amount: "보유금액", profit_loss: "손익", buy_amount: "매수금액",
  asset_category: "자산구분", concentration_score: "집중도", volatility: "변동성",
};
function toKr(col: string): string {
  return COL_KR[col] || col.replace(/_/g, " ").replace(/\b[a-z]/g, c => c.toUpperCase());
}

/* ===== Number Formatting ===== */
function fmtKRW(val: any): string {
  if (val === null || val === undefined || val === "") return "-";
  const n = Number(val);
  if (isNaN(n)) return String(val);
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억원`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}
function fmtCompact(val: any): string {
  const n = Number(val);
  if (isNaN(n)) return String(val ?? "-");
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`;
  if (Math.abs(n) < 100 && n !== 0 && String(val).includes(".")) return `${n.toFixed(2)}%`;
  return n.toLocaleString("ko-KR");
}
function fmtPct(val: any): string {
  const n = Number(val);
  if (isNaN(n)) return "-";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/* ===== History ===== */
function loadHistory(): string[] {
  try { return JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

/* ===== Main Page ===== */
function ChatPage() {
  const { customer } = useCustomer();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
      setMessages(p => [...p, { role: "bot", text: data.answer || "분석 완료", sql: data.sql, tableData }]);
    } catch (e: any) {
      setMessages(p => [...p, { role: "bot", text: `오류: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  const handleSend = () => { const t = input.trim(); if (!t) return; setInput(""); sendQuestion(t); };

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col bg-[#F5F6FA]">
        {/* Header */}
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
              ) : <BotMessage key={i} msg={m} customerName={customer.name} />)}
              {loading && <LoadingPulse name={customer.name} />}
              <div ref={endRef} />
            </div>
          )}
        </main>

        {/* Input Bar */}
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
        <p className="text-[13px] text-gray-500 leading-relaxed">포트폴리오 분석, 종목 진단, 리스크 점검 등 투자에 관한 질문을 해보세요.</p>
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

/* ===== Loading ===== */
function LoadingPulse({ name }: { name: string }) {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-5 py-4 max-w-[88%]">
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

/* ===== Bot Message - Main Report Renderer ===== */
function BotMessage({ msg, customerName }: { msg: Msg & { role: "bot" }; customerName: string }) {
  const sections = parseAnswer(msg.text);
  const charts = msg.tableData ? buildCharts(msg.tableData) : [];

  return (
    <div className="flex justify-start w-full">
      <div className="w-full space-y-3">
        {/* Main Summary Card */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
                <Activity className="size-3.5 text-white" />
              </div>
              <span className="text-[13px] font-bold text-gray-800">{customerName}님 분석 결과</span>
            </div>
            {/* Summary text */}
            {sections.summary && (
              <p className="text-[13.5px] text-gray-700 leading-[1.7] whitespace-pre-wrap">{sections.summary}</p>
            )}
          </div>

          {/* Inline chart - first chart embedded in summary card */}
          {charts.length > 0 && charts[0].type === "donut" && (
            <div className="px-4 pb-4 pt-1">
              <DonutChart chart={charts[0]} />
            </div>
          )}
          {charts.length > 0 && charts[0].type === "hbar" && (
            <div className="px-4 pb-4 pt-1">
              <HBarChart chart={charts[0]} />
            </div>
          )}
        </div>

        {/* Additional charts as separate mini-cards */}
        {charts.slice(1).map((chart, i) => (
          <div key={i} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-6 rounded-md flex items-center justify-center" style={{ backgroundColor: CHART_COLORS[i + 1] + "20" }}>
                {chart.type === "donut" ? <PieIcon className="size-3.5" style={{ color: CHART_COLORS[i + 1] }} /> : <BarChart3 className="size-3.5" style={{ color: CHART_COLORS[i + 1] }} />}
              </div>
              <span className="text-[12px] font-semibold text-gray-700">{chart.title}</span>
            </div>
            {chart.type === "donut" ? <DonutChart chart={chart} /> : <HBarChart chart={chart} />}
          </div>
        ))}

        {/* Detail sections as cards */}
        {sections.details.map((sec, i) => (
          <div key={i} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="size-6 rounded-md flex items-center justify-center" style={{ backgroundColor: getSectionStyle(sec.title).bg }}>
                {getSectionStyle(sec.title).icon}
              </div>
              <span className="text-[12.5px] font-bold text-gray-800">{sec.title}</span>
            </div>
            <div className="space-y-2">
              {sec.items.map((item, j) => (
                <div key={j} className="flex items-start gap-2.5 pl-1">
                  <span className="size-1.5 rounded-full mt-[7px] shrink-0" style={{ backgroundColor: CHART_COLORS[j % CHART_COLORS.length] }} />
                  <span className="text-[13px] text-gray-600 leading-[1.6]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Metric chips if single-value data */}
        {msg.tableData && msg.tableData.rows.length === 1 && msg.tableData.columns.length <= 4 && charts.length === 0 && (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <div className="grid grid-cols-2 gap-3">
              {msg.tableData.columns.map((col, ci) => {
                const val = msg.tableData!.rows[0][ci];
                const numVal = Number(val);
                const isRate = col.includes("rate") || col.includes("pct") || col.includes("ratio");
                return (
                  <div key={ci} className="rounded-xl p-3" style={{ backgroundColor: "#F8F9FF" }}>
                    <p className="text-[11px] text-gray-400 mb-1">{toKr(col)}</p>
                    <p className={`text-[16px] font-bold ${isRate && !isNaN(numVal) ? (numVal >= 0 ? "text-emerald-600" : "text-red-500") : "text-gray-800"}`}>
                      {isRate && !isNaN(numVal) ? fmtPct(numVal) : fmtCompact(val)}
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


/* ===== Donut Chart Component ===== */
function DonutChart({ chart }: { chart: ChartData }) {
  const total = chart.data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-4">
      <div className="w-[140px] h-[140px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chart.data} cx="50%" cy="50%" innerRadius={38} outerRadius={62}
              paddingAngle={2} dataKey="value" stroke="none">
              {chart.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => fmtCompact(v)} contentStyle={{ borderRadius: 10, fontSize: 11, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {chart.data.slice(0, 5).map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="text-[11.5px] text-gray-600 truncate flex-1">{d.name}</span>
            <span className="text-[11.5px] font-semibold text-gray-800 shrink-0">{total > 0 ? `${((d.value / total) * 100).toFixed(0)}%` : fmtCompact(d.value)}</span>
          </div>
        ))}
        {chart.data.length > 5 && (
          <p className="text-[10px] text-gray-400 pl-4">외 {chart.data.length - 5}건</p>
        )}
      </div>
    </div>
  );
}

/* ===== Horizontal Bar Chart Component ===== */
function HBarChart({ chart }: { chart: ChartData }) {
  const maxVal = Math.max(...chart.data.map(d => Math.abs(d.value)), 1);
  return (
    <div className="space-y-2">
      {chart.data.slice(0, 8).map((d, i) => {
        const pct = (Math.abs(d.value) / maxVal) * 100;
        const isNeg = d.value < 0;
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] text-gray-600 truncate max-w-[55%]">{d.name}</span>
              <span className={`text-[11.5px] font-semibold ${isNeg ? "text-red-500" : "text-gray-800"}`}>{fmtCompact(d.value)}</span>
            </div>
            <div className="h-[6px] rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: isNeg ? "#EF4444" : `linear-gradient(90deg, ${GRADIENT_COLORS[i % GRADIENT_COLORS.length][0]}, ${GRADIENT_COLORS[i % GRADIENT_COLORS.length][1]})` }} />
            </div>
          </div>
        );
      })}
      {chart.data.length > 8 && (
        <p className="text-[10px] text-gray-400 text-center pt-1">외 {chart.data.length - 8}건</p>
      )}
    </div>
  );
}

/* ===== Chart Data Building ===== */
type ChartData = { type: "donut" | "hbar"; title: string; data: { name: string; value: number }[] };

function buildCharts(td: TableData): ChartData[] {
  if (!td.columns.length || !td.rows.length) return [];

  const numericIndices = td.columns.map((_, ci) => ci).filter(ci => td.rows.some(r => { const v = r[ci]; return v !== null && v !== "" && !isNaN(Number(v)); }));
  const stringIndices = td.columns.map((_, ci) => ci).filter(ci => td.rows.some(r => typeof r[ci] === "string" && isNaN(Number(r[ci]))));

  if (numericIndices.length === 0) return [];

  const labelIdx = stringIndices[0] ?? 0;
  const charts: ChartData[] = [];

  // Determine if data is ratio/weight type
  const isRatioType = td.columns.some(c => c.includes("ratio") || c.includes("weight") || c.includes("비중") || c.includes("allocation"));

  // Single row with multiple numeric cols → multiple metric cards (handled elsewhere) or donut if ratio
  if (td.rows.length === 1 && numericIndices.length >= 3 && isRatioType) {
    const data = numericIndices.map(ci => ({
      name: toKr(td.columns[ci]),
      value: Math.abs(Number(td.rows[0][ci]) || 0),
    })).filter(d => d.value > 0);
    if (data.length >= 2) {
      charts.push({ type: "donut", title: "자산 배분 현황", data });
    }
    return charts;
  }

  // Multiple rows: build primary chart
  if (td.rows.length > 1) {
    const primaryValueIdx = numericIndices[0];
    const primaryCol = td.columns[primaryValueIdx];

    // Build data
    const data = td.rows.slice(0, 15).map(row => ({
      name: String(row[labelIdx] ?? "").slice(0, 12) || "-",
      value: Number(row[primaryValueIdx]) || 0,
    })).filter(d => d.value !== 0 || td.rows.length <= 5);

    if (data.length >= 2) {
      // Decide chart type
      if (isRatioType || primaryCol.includes("weight") || primaryCol.includes("ratio")) {
        charts.push({ type: "donut", title: toKr(primaryCol) + " 구성", data: data.map(d => ({ ...d, value: Math.abs(d.value) })) });
      } else {
        charts.push({ type: "hbar", title: toKr(primaryCol) + " 비교", data });
      }
    }

    // If there is a second numeric column, create additional chart
    if (numericIndices.length >= 2) {
      const secondIdx = numericIndices[1];
      const secondCol = td.columns[secondIdx];
      const data2 = td.rows.slice(0, 10).map(row => ({
        name: String(row[labelIdx] ?? "").slice(0, 12) || "-",
        value: Number(row[secondIdx]) || 0,
      })).filter(d => d.value !== 0);

      if (data2.length >= 2 && secondCol !== primaryCol) {
        const isRatio2 = secondCol.includes("ratio") || secondCol.includes("weight") || secondCol.includes("rate");
        charts.push({ type: isRatio2 ? "donut" : "hbar", title: toKr(secondCol), data: data2.map(d => ({ ...d, value: Math.abs(d.value) })) });
      }
    }
  }

  return charts;
}

/* ===== Answer Text Parsing ===== */
function parseAnswer(text: string): { summary: string; details: { title: string; items: string[] }[] } {
  if (!text) return { summary: "", details: [] };
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let summary = "";
  const details: { title: string; items: string[] }[] = [];
  let cur: { title: string; items: string[] } | null = null;

  for (const line of lines) {
    const hdr = line.match(/^\*\*(.+?)\*\*:?\s*$/) || line.match(/^#{1,3}\s+(.+)/) || line.match(/^\[(.+?)\]\s*$/);
    if (hdr) {
      if (cur && cur.items.length) details.push(cur);
      cur = { title: hdr[1].replace(/\*\*/g, "").trim(), items: [] };
      continue;
    }
    const bullet = line.match(/^[-•*]\s*\*?\*?(.+?)\*?\*?$/);
    if (bullet && cur) {
      cur.items.push(bullet[1].replace(/\*\*/g, "").trim());
      continue;
    }
    if (!cur) { summary += (summary ? "\n" : "") + line.replace(/\*\*/g, ""); }
    else { cur.items.push(line.replace(/\*\*/g, "")); }
  }
  if (cur && cur.items.length) details.push(cur);
  return { summary, details };
}

/* ===== Section Style Helper ===== */
function getSectionStyle(title: string): { bg: string; icon: React.ReactNode } {
  if (title.includes("리스크") || title.includes("위험") || title.includes("진단"))
    return { bg: "#FEF2F2", icon: <Shield className="size-3.5 text-red-500" /> };
  if (title.includes("수익") || title.includes("성과") || title.includes("분석"))
    return { bg: "#F0FDF4", icon: <TrendingUp className="size-3.5 text-emerald-500" /> };
  if (title.includes("배분") || title.includes("비중") || title.includes("구성"))
    return { bg: "#EFF6FF", icon: <PieIcon className="size-3.5 text-blue-500" /> };
  if (title.includes("추천") || title.includes("제안") || title.includes("전략"))
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
            <button onClick={onClear} className="w-full text-[12px] text-gray-400 hover:text-red-400 py-2 transition-colors">전체 삭제</button>
          </div>
        )}
      </aside>
    </div>
  );
}
