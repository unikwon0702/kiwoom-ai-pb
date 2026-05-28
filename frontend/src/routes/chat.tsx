import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, X, Send, Menu, Mic, User, Activity, Zap } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useCustomer } from "@/lib/customer-context";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
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
const COLORS = ["#606CF2", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6", "#6366F1", "#F97316"];
const GRADIENTS = [["#606CF2","#818CF8"],["#8B5CF6","#A78BFA"],["#06B6D4","#22D3EE"],["#10B981","#34D399"],["#F59E0B","#FBBF24"],["#EF4444","#FB7185"]];

/* ===== Korean Labels ===== */
const COL_KR: Record<string, string> = {
  total_profit_loss:"총손익", evaluation_amount:"평가금액", valuation_amount:"평가금액",
  stock_ratio:"주식", bond_ratio:"채권", cash_ratio:"현금", etf_ratio:"ETF",
  risk_score:"위험도", asset_name:"종목명", asset_type:"자산유형",
  holding_weight:"비중", total_return_rate:"총수익률", profit_loss_rate:"손익률",
  purchase_amount:"매수금액", current_price:"현재가", return_rate:"수익률",
  weight:"비중", domestic_ratio:"국내", overseas_ratio:"해외",
  holding_amount:"보유금액", profit_loss:"손익", buy_amount:"매수금액",
  asset_category:"자산구분", concentration_score:"집중도", volatility:"변동성",
  bond_fund_ratio:"채권펀드", market_value:"시장가치", quantity:"수량",
};
function toKr(col: string): string { return COL_KR[col] || col.replace(/_/g," "); }

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
  // Build charts from table data
  const tableCharts = msg.tableData ? buildChartsFromTable(msg.tableData) : [];
  // Extract numeric data from text for additional charts
  const textCharts = extractChartsFromText(msg.text);
  // Combine: prioritize table charts, supplement with text charts
  const allCharts = tableCharts.length >= 2 ? tableCharts : [...tableCharts, ...textCharts].slice(0, 3);
  // Format the answer text
  const formatted = formatAnswer(msg.text);

  return (
    <div className="flex justify-start w-full">
      <div className="w-full space-y-3">
        {/* Main Card: Formatted Text */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
              <Activity className="size-3.5 text-white" />
            </div>
            <span className="text-[13px] font-bold text-gray-800">{customerName}님 분석 결과</span>
          </div>
          <div className="space-y-3">
            {formatted.map((block, i) => <FormattedBlock key={i} block={block} />)}
          </div>
        </div>

        {/* Charts */}
        {allCharts.map((chart, i) => (
          <div key={i} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[14px]">{chart.emoji}</span>
              <span className="text-[12px] font-bold text-gray-700">{chart.title}</span>
            </div>
            {chart.type === "donut" ? <InlineDonut data={chart.data} /> : <InlineBar data={chart.data} />}
          </div>
        ))}

        {/* Metric cards for single-row data */}
        {msg.tableData && msg.tableData.rows.length === 1 && msg.tableData.columns.length >= 2 && msg.tableData.columns.length <= 4 && tableCharts.length === 0 && (
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


/* ===== Formatted Text Block ===== */
type TextBlock =
  | { type: "headline"; emoji: string; text: string }
  | { type: "metric"; label: string; value: string; positive?: boolean }
  | { type: "bullet"; emoji: string; bold: string; rest: string }
  | { type: "text"; content: string };

function FormattedBlock({ block }: { block: TextBlock }) {
  if (block.type === "headline") {
    return (
      <div className="flex items-start gap-2">
        <span className="text-[15px] mt-0.5">{block.emoji}</span>
        <p className="text-[14px] font-bold text-gray-800 leading-relaxed">{block.text}</p>
      </div>
    );
  }
  if (block.type === "metric") {
    return (
      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#F8F9FF] to-[#F0F4FF]">
        <span className="text-[12.5px] text-gray-500">{block.label}</span>
        <span className={`text-[15px] font-bold ${block.positive === true ? "text-emerald-600" : block.positive === false ? "text-red-500" : "text-gray-800"}`}>{block.value}</span>
      </div>
    );
  }
  if (block.type === "bullet") {
    return (
      <div className="flex items-start gap-2 pl-1">
        <span className="text-[13px] mt-0.5">{block.emoji}</span>
        <p className="text-[13px] text-gray-600 leading-[1.65]">
          <span className="font-semibold text-gray-800">{block.bold}</span>
          {block.rest && <span> {block.rest}</span>}
        </p>
      </div>
    );
  }
  return <p className="text-[13px] text-gray-600 leading-[1.7] pl-1">{block.content}</p>;
}

/* ===== Text Formatting Logic ===== */
function formatAnswer(text: string): TextBlock[] {
  if (!text) return [];
  const lines = text.split("\n").filter(l => l.trim());
  const blocks: TextBlock[] = [];
  const sectionEmojis = ["📊", "💡", "📈", "⚠️", "🎯", "💰", "🔍", "📋", "✅", "🏦"];
  let emojiIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect metric-like patterns: "총 평가금액: 2.5억원" or "수익률: +12.54%"
    const metricMatch = line.match(/^[-•*]?\s*\*?\*?(.+?)\*?\*?[:：]\s*\*?\*?([\+\-]?[\d,.]+[%억만원조개]+.*?)\*?\*?$/);
    if (metricMatch) {
      const val = metricMatch[2].trim();
      const isPos = val.startsWith("+") || (val.includes("%") && !val.startsWith("-") && parseFloat(val) > 0);
      const isNeg = val.startsWith("-");
      blocks.push({ type: "metric", label: metricMatch[1].replace(/\*\*/g, "").trim(), value: val, positive: isPos ? true : isNeg ? false : undefined });
      continue;
    }

    // Detect headlines (bold text or first meaningful sentence)
    const headlineMatch = line.match(/^\*\*(.+?)\*\*\.?\s*$/);
    if (headlineMatch) {
      blocks.push({ type: "headline", emoji: sectionEmojis[emojiIdx++ % sectionEmojis.length], text: headlineMatch[1] });
      continue;
    }

    // Detect bullet points with bold prefix
    const bulletBold = line.match(/^[-•*]\s*\*\*(.+?)\*\*[:：]?\s*(.*)$/);
    if (bulletBold) {
      const bulletEmojis = ["📌", "💎", "🔹", "▪️", "➤", "•"];
      blocks.push({ type: "bullet", emoji: bulletEmojis[blocks.filter(b => b.type === "bullet").length % bulletEmojis.length], bold: bulletBold[1], rest: bulletBold[2].replace(/\*\*/g, "") });
      continue;
    }

    // Detect simple bullets
    const simpleBullet = line.match(/^[-•*]\s+(.+)$/);
    if (simpleBullet) {
      const content = simpleBullet[1].replace(/\*\*/g, "");
      // Check if it contains a colon for label:value pattern
      const colonSplit = content.match(/^(.+?)[:：]\s*(.+)$/);
      if (colonSplit) {
        blocks.push({ type: "bullet", emoji: "▪️", bold: colonSplit[1].trim(), rest: colonSplit[2].trim() });
      } else {
        blocks.push({ type: "bullet", emoji: "▪️", bold: "", rest: content });
      }
      continue;
    }

    // First line or lines with numbers → headline treatment
    if (i === 0 || (i <= 2 && line.length < 60 && !line.startsWith("-"))) {
      blocks.push({ type: "headline", emoji: sectionEmojis[emojiIdx++ % sectionEmojis.length], text: line.replace(/\*\*/g, "") });
      continue;
    }

    // Default: regular text
    blocks.push({ type: "text", content: line.replace(/\*\*/g, "") });
  }

  // If no headlines were created, promote first block
  if (blocks.length > 0 && !blocks.some(b => b.type === "headline")) {
    const first = blocks[0];
    if (first.type === "text") {
      blocks[0] = { type: "headline", emoji: "📊", text: first.content };
    }
  }

  return blocks;
}

/* ===== Extract Charts from Text (when no table_data) ===== */
type ChartItem = { type: "donut" | "hbar"; title: string; emoji: string; data: { name: string; value: number }[] };

function extractChartsFromText(text: string): ChartItem[] {
  if (!text) return [];
  const charts: ChartItem[] = [];

  // Pattern 1: "종목: 금액" or "종목(+XX%)" patterns
  const assetValuePairs: { name: string; value: number }[] = [];
  const assetPatterns = text.matchAll(/[-•*]\s*\*?\*?(.+?)\*?\*?[:：]\s*([\+\-]?[\d,.]+)\s*(억|만|원|%)/g);
  for (const m of assetPatterns) {
    let name = m[1].replace(/\*\*/g, "").trim().slice(0, 10);
    let val = parseFloat(m[2].replace(/,/g, ""));
    const unit = m[3];
    if (unit === "억") val *= 1e8;
    else if (unit === "만") val *= 1e4;
    if (name && !isNaN(val) && val !== 0) {
      assetValuePairs.push({ name, value: Math.abs(val) });
    }
  }

  // Pattern 2: percentage items like "삼성전자(+4.2%)", "SK하이닉스(+3.1%)"
  const pctPairs: { name: string; value: number }[] = [];
  const pctPatterns = text.matchAll(/([가-힣A-Za-z0-9\s]+?)\s*[\(（]\s*([\+\-]?[\d.]+)\s*%\s*[\)）]/g);
  for (const m of pctPatterns) {
    const name = m[1].trim().slice(0, 10);
    const val = parseFloat(m[2]);
    if (name && !isNaN(val)) pctPairs.push({ name, value: val });
  }

  // Pattern 3: ratio/allocation like "국내 주식 68%, 해외 주식 18%"
  const ratioPairs: { name: string; value: number }[] = [];
  const ratioPatterns = text.matchAll(/([가-힣A-Za-z/\s]+?)\s*([\d.]+)\s*%/g);
  for (const m of ratioPatterns) {
    const name = m[1].trim().slice(0, 8);
    const val = parseFloat(m[2]);
    // Only collect if it looks like allocation (multiple items summing ~100%)
    if (name && !isNaN(val) && val > 0 && val <= 100 && name.length >= 2) {
      ratioPairs.push({ name, value: val });
    }
  }

  // Build charts from extracted data
  if (assetValuePairs.length >= 3) {
    charts.push({
      type: "hbar", title: "종목별 현황", emoji: "📊",
      data: assetValuePairs.slice(0, 8)
    });
  }

  if (pctPairs.length >= 3) {
    charts.push({
      type: "hbar", title: "종목별 수익률", emoji: "📈",
      data: pctPairs.slice(0, 8)
    });
  }

  // Ratio data → donut (only if it looks like allocation: 3+ items, sum > 50%)
  const ratioSum = ratioPairs.reduce((s, d) => s + d.value, 0);
  if (ratioPairs.length >= 3 && ratioSum > 50 && ratioSum <= 120) {
    charts.push({
      type: "donut", title: "자산 배분 현황", emoji: "🎯",
      data: ratioPairs.slice(0, 8)
    });
  }

  // If still no charts, try to create a summary chart from any numeric mentions
  if (charts.length === 0) {
    const anyNumbers: { name: string; value: number }[] = [];
    const lines = text.split("\n");
    for (const line of lines) {
      const match = line.match(/[-•*]\s*\*?\*?([가-힣A-Za-z0-9\s]+?)\*?\*?.*?([\d,.]+)\s*(억|만|%|원)/);
      if (match) {
        let val = parseFloat(match[2].replace(/,/g, ""));
        const unit = match[3];
        if (unit === "억") val *= 100;
        else if (unit === "만") val *= 1;
        else if (unit === "%") val = val;
        const name = match[1].replace(/\*\*/g, "").trim().slice(0, 10);
        if (name && !isNaN(val) && val > 0) anyNumbers.push({ name, value: val });
      }
    }
    if (anyNumbers.length >= 2) {
      charts.push({ type: "hbar", title: "주요 지표 비교", emoji: "📋", data: anyNumbers.slice(0, 8) });
    }
  }

  return charts;
}


/* ===== Inline Donut ===== */
function InlineDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  // Group tiny items into "기타"
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

/* ===== Build Charts from Table Data ===== */
function buildChartsFromTable(td: TableData): ChartItem[] {
  if (!td.columns.length || !td.rows.length) return [];

  const numIdx = td.columns.map((_, ci) => ci).filter(ci => td.rows.some(r => { const v = r[ci]; return v !== null && v !== "" && !isNaN(Number(v)); }));
  const strIdx = td.columns.map((_, ci) => ci).filter(ci => td.rows.some(r => typeof r[ci] === "string" && isNaN(Number(r[ci]))));

  if (numIdx.length === 0) return [];
  const labelIdx = strIdx[0] ?? 0;
  const charts: ChartItem[] = [];

  const isRatio = td.columns.some(c => c.includes("ratio") || c.includes("weight") || c.includes("비중"));

  // Single row, multiple numeric = donut or metrics
  if (td.rows.length === 1 && numIdx.length >= 3 && isRatio) {
    const data = numIdx.map(ci => ({ name: toKr(td.columns[ci]), value: Math.abs(Number(td.rows[0][ci]) || 0) })).filter(d => d.value > 0);
    if (data.length >= 2) charts.push({ type: "donut", title: "자산 배분 구성", emoji: "🎯", data });
    return charts;
  }

  // Multiple rows
  if (td.rows.length > 1) {
    const v1Idx = numIdx[0];
    const data1 = td.rows.slice(0, 10).map(r => ({
      name: String(r[labelIdx] ?? "").slice(0, 12) || "-",
      value: Number(r[v1Idx]) || 0
    })).filter(d => d.value !== 0 || td.rows.length <= 5);

    if (data1.length >= 2) {
      const col1 = td.columns[v1Idx];
      if (isRatio || col1.includes("weight") || col1.includes("ratio")) {
        charts.push({ type: "donut", title: toKr(col1) + " 구성", emoji: "🎯", data: data1.map(d => ({ ...d, value: Math.abs(d.value) })) });
      } else {
        charts.push({ type: "hbar", title: toKr(col1) + " 비교", emoji: "📊", data: data1 });
      }
    }

    // Second numeric column → second chart
    if (numIdx.length >= 2) {
      const v2Idx = numIdx[1];
      const col2 = td.columns[v2Idx];
      const data2 = td.rows.slice(0, 8).map(r => ({
        name: String(r[labelIdx] ?? "").slice(0, 12) || "-",
        value: Number(r[v2Idx]) || 0
      })).filter(d => d.value !== 0);

      if (data2.length >= 2) {
        const isR2 = col2.includes("ratio") || col2.includes("weight") || col2.includes("rate");
        charts.push({ type: isR2 ? "donut" : "hbar", title: toKr(col2), emoji: isR2 ? "📈" : "💰", data: data2.map(d => ({ ...d, value: Math.abs(d.value) })) });
      }
    }
  }

  return charts;
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
