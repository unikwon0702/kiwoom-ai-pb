import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, X, Send, Menu, Mic, User, TrendingUp, TrendingDown, PieChart as PieIcon, BarChart3, Activity, Shield, Newspaper, Info } from "lucide-react";
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
type ChartType = "donut" | "hbar" | "none";
type Msg =
  | { role: "user"; text: string }
  | { role: "bot"; text: string; sql?: string | null; tableData?: TableData | null };

/* ===== Constants ===== */
const HISTORY_KEY = "aipb_chat_questions";
const COLORS = ["#606CF2", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#6366F1", "#14B8A6", "#F97316"];

/* ===== Korean Column Mapping ===== */
const COL_KR: Record<string, string> = {
  total_profit_loss: "총손익", evaluation_amount: "평가금액", valuation_amount: "평가금액",
  stock_ratio: "주식 비중", bond_ratio: "채권 비중", cash_ratio: "현금 비중",
  risk_score: "위험도", negative_impact: "부정 영향", positive_impact: "긍정 영향",
  asset_name: "종목명", asset_type: "자산유형", holding_weight: "비중",
  total_return_rate: "수익률", customer_name: "고객명", age_group: "연령대",
  investment_style: "투자성향", total_asset_value: "총자산", sector: "섹터",
  profit_loss_rate: "손익률", purchase_amount: "매수금액", current_price: "현재가",
  quantity: "수량", avg_buy_price: "평균매수가", return_rate: "수익률",
  market_value: "시장가치", weight: "비중", domestic_ratio: "국내비중",
  overseas_ratio: "해외비중", etf_ratio: "ETF비중", bond_fund_ratio: "채권펀드비중",
};

function toKr(col: string): string {
  return COL_KR[col] || col.replace(/_/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/* ===== Number Formatting ===== */
function fmtNum(val: any): string {
  if (val === null || val === undefined || val === "") return "-";
  const n = Number(val);
  if (isNaN(n)) return String(val);
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}만`;
  if (Math.abs(n) < 100 && String(val).includes(".")) return `${n.toFixed(1)}%`;
  return n.toLocaleString("ko-KR");
}

function fmtAxis(val: any): string {
  const n = Number(val);
  if (isNaN(n)) return String(val);
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(0)}억`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}만`;
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
    if (!customer?.id) {
      setMessages((p) => [...p, { role: "bot", text: "고객을 먼저 선택해주세요." }]);
      return;
    }
    setMessages((p) => [...p, { role: "user", text }]);
    setLoading(true);
    setHistory((p) => { const n = [text, ...p.filter((q) => q !== text)].slice(0, 30); try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(n)); } catch {} return n; });

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
      setMessages((p) => [...p, { role: "bot", text: data.answer || "응답을 받았습니다.", sql: data.sql, tableData }]);
    } catch (e: any) {
      setMessages((p) => [...p, { role: "bot", text: `오류가 발생했습니다: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  const handleSend = () => { const t = input.trim(); if (!t) return; setInput(""); sendQuestion(t); };

  return (
    <div className="min-h-screen bg-[#F4F6FB]">
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col bg-[#F4F6FB]">
        {/* Header */}
        <header className="sticky top-0 z-10" style={{ background: "linear-gradient(135deg, #606CF2 0%, #8B5CF6 100%)" }}>
          <div className="flex items-center justify-between px-3 h-14">
            <Link to="/" className="size-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white"><ChevronLeft className="size-5" /></Link>
            <span className="text-[16px] font-semibold text-white">AI PB 리포트</span>
            <div className="flex items-center">
              <button onClick={() => setMenuOpen(true)} className="size-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white"><Menu className="size-5" /></button>
              <Link to="/" className="size-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white"><X className="size-5" /></Link>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 pb-2.5">
            <div className="size-5 rounded-full bg-white/20 flex items-center justify-center"><User className="size-3 text-white" /></div>
            <span className="text-[12px] text-white/90 font-medium">{customer.name} 고객님 맞춤 분석</span>
          </div>
        </header>

        <HistoryPanel open={menuOpen} onClose={() => setMenuOpen(false)} history={history}
          onSelect={(q) => { setMenuOpen(false); sendQuestion(q); }}
          onClear={() => { setHistory([]); try { window.localStorage.removeItem(HISTORY_KEY); } catch {} }} />

        {/* Body */}
        <main className="flex-1 px-4 pt-5 pb-4">
          {messages.length === 0 ? (
            <EmptyState customerName={customer.name} onSend={sendQuestion} />
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => m.role === "user" ? (
                <div key={i} className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] text-white" style={{ background: "linear-gradient(135deg, #606CF2, #8B5CF6)" }}>{m.text}</div></div>
              ) : ( <BotMessage key={i} msg={m} customerName={customer.name} /> ))}
              {loading && <LoadingIndicator name={customer.name} />}
              <div ref={endRef} />
            </div>
          )}
        </main>

        {/* Input */}
        <div className="sticky bottom-0 px-4 pb-5 pt-3 bg-[#F4F6FB]">
          <div className="rounded-full p-px bg-gradient-to-r from-[#606CF2] via-[#8B5CF6] to-[#EC4899]">
            <div className="flex items-center gap-2 rounded-full bg-white pl-2 pr-1.5 py-1.5">
              <button className="size-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50"><Mic className="size-[18px]" /></button>
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder="질문을 입력하세요" className="flex-1 bg-transparent text-[14px] text-gray-800 placeholder:text-gray-400 outline-none py-2" />
              <button onClick={handleSend} className="size-9 rounded-full flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #606CF2, #8B5CF6)" }}><Send className="size-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Empty State ===== */
function EmptyState({ customerName, onSend }: { customerName: string; onSend: (q: string) => void }) {
  const suggestions = ["내 포트폴리오 종합 진단해줘", "보유 종목별 수익률 알려줘", "내 자산 배분 현황 분석해줘", "투자 리스크 진단해줘"];
  return (
    <div className="pt-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #606CF2, #8B5CF6)" }}>
            <Activity className="size-4 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-gray-800">AI PB 투자 진단</p>
            <p className="text-[12px] text-gray-400">{customerName} 고객님 전용</p>
          </div>
        </div>
        <p className="text-[13.5px] text-gray-600 leading-relaxed mb-4">포트폴리오 분석, 종목 진단, 시장 전망 등<br/>투자에 관한 질문을 해주세요.</p>
        <div className="space-y-2">
          {suggestions.map((q) => (
            <button key={q} onClick={() => onSend(q)} className="w-full text-left px-4 py-3 rounded-xl bg-[#F8F9FF] border border-[#E8ECFF] text-[13px] text-gray-700 hover:bg-[#F0F2FF] transition-colors">{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== Loading Indicator ===== */
function LoadingIndicator({ name }: { name: string }) {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3 max-w-[90%]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="size-2 rounded-full bg-[#606CF2] animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="size-2 rounded-full bg-[#8B5CF6] animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="size-2 rounded-full bg-[#EC4899] animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-[13px] text-gray-500">{name} 고객님 데이터 분석 중...</span>
        </div>
      </div>
    </div>
  );
}

/* ===== Bot Message ===== */
function BotMessage({ msg, customerName }: { msg: Msg & { role: "bot" }; customerName: string }) {
  const sections = parseResponseSections(msg.text);
  const chartInfo = msg.tableData ? analyzeChart(msg.tableData) : null;

  return (
    <div className="flex justify-start w-full">
      <div className="w-full space-y-3">
        {/* Summary Card */}
        {sections.summary && (
          <ReportCard icon={<Activity className="size-4" />} title="분석 요약" color="#606CF2">
            <p className="text-[13.5px] text-gray-700 leading-relaxed whitespace-pre-wrap">{sections.summary}</p>
          </ReportCard>
        )}

        {/* Chart Card */}
        {chartInfo && chartInfo.type !== "none" && (
          <ReportCard icon={<BarChart3 className="size-4" />} title="시각화" color="#8B5CF6">
            <ChartRenderer chartInfo={chartInfo} />
          </ReportCard>
        )}

        {/* Detail Cards */}
        {sections.details.length > 0 && sections.details.map((sec, i) => (
          <ReportCard key={i} icon={getSectionIcon(sec.title)} title={sec.title} color={getSectionColor(i)}>
            <div className="space-y-1.5">
              {sec.items.map((item, j) => (
                <div key={j} className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-gray-300 mt-2 shrink-0" />
                  <span className="text-[13px] text-gray-600 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </ReportCard>
        ))}

        {/* Fallback: plain text if no structured content */}
        {!sections.summary && sections.details.length === 0 && (
          <ReportCard icon={<Activity className="size-4" />} title={`${customerName}님 분석 결과`} color="#606CF2">
            <p className="text-[13.5px] text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
          </ReportCard>
        )}

        {/* SQL (dev only, collapsed) */}
        {msg.sql && (
          <details className="text-[11px] px-1">
            <summary className="text-gray-400 cursor-pointer hover:text-gray-500">실행된 SQL 보기</summary>
            <pre className="mt-1 p-2.5 rounded-xl bg-[#1e1e2e] text-[#cdd6f4] text-[10px] overflow-x-auto leading-relaxed">{msg.sql}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

/* ===== Report Card Component ===== */
function ReportCard({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <div className="size-6 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: color }}>{icon}</div>
        <span className="text-[13px] font-semibold text-gray-800">{title}</span>
      </div>
      <div className="px-4 pb-4">{children}</div>
    </div>
  );
}

/* ===== Section Parsing ===== */
function parseResponseSections(text: string): { summary: string; details: { title: string; items: string[] }[] } {
  if (!text) return { summary: "", details: [] };

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let summary = "";
  const details: { title: string; items: string[] }[] = [];
  let currentSection: { title: string; items: string[] } | null = null;

  for (const line of lines) {
    // Detect section headers (bold **text** or lines ending with :)
    const headerMatch = line.match(/^\*\*(.+?)\*\*:?$/) || line.match(/^#+\s*(.+)/) || line.match(/^\[(.+?)\]$/);
    if (headerMatch) {
      if (currentSection && currentSection.items.length > 0) details.push(currentSection);
      currentSection = { title: headerMatch[1].trim(), items: [] };
      continue;
    }

    // Detect bullet items
    const bulletMatch = line.match(/^[-•*]\s*\*?\*?(.+?)\*?\*?:?\s*(.*)$/);
    if (bulletMatch && currentSection) {
      const content = bulletMatch[2] ? `${bulletMatch[1].replace(/\*\*/g, "")}: ${bulletMatch[2]}` : bulletMatch[1].replace(/\*\*/g, "");
      currentSection.items.push(content.trim());
      continue;
    }

    // If no section yet, accumulate as summary
    if (!currentSection) {
      summary += (summary ? "\n" : "") + line.replace(/\*\*/g, "");
    } else {
      currentSection.items.push(line.replace(/\*\*/g, ""));
    }
  }

  if (currentSection && currentSection.items.length > 0) details.push(currentSection);

  // If only 1-2 short lines, treat all as summary
  if (!summary && details.length === 1 && details[0].items.length <= 2) {
    summary = details[0].items.join("\n");
    return { summary, details: [] };
  }

  return { summary, details };
}

function getSectionIcon(title: string): React.ReactNode {
  if (title.includes("진단") || title.includes("리스크") || title.includes("위험")) return <Shield className="size-4" />;
  if (title.includes("수익") || title.includes("성과")) return <TrendingUp className="size-4" />;
  if (title.includes("배분") || title.includes("비중") || title.includes("구성")) return <PieIcon className="size-4" />;
  if (title.includes("이벤트") || title.includes("뉴스") || title.includes("시장")) return <Newspaper className="size-4" />;
  if (title.includes("기술") || title.includes("차트") || title.includes("추세")) return <Activity className="size-4" />;
  return <BarChart3 className="size-4" />;
}

function getSectionColor(index: number): string {
  const colors = ["#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
  return colors[index % colors.length];
}

/* ===== Chart Analysis & Rendering ===== */
type ChartInfo = { type: ChartType; data: Record<string, any>[]; labelCol: string; valueCols: string[] };

function analyzeChart(td: TableData): ChartInfo | null {
  if (!td.columns.length || !td.rows.length) return null;

  const numericCols = td.columns.filter((_, ci) => td.rows.some(r => { const v = r[ci]; return v !== null && v !== "" && !isNaN(Number(v)); }));
  const stringCols = td.columns.filter((_, ci) => td.rows.some(r => typeof r[ci] === "string" && isNaN(Number(r[ci]))));

  if (numericCols.length === 0) return null;

  const labelCol = stringCols[0] || td.columns[0];
  const data = td.rows.slice(0, 15).map(row => {
    const obj: Record<string, any> = {};
    td.columns.forEach((col, i) => {
      const v = row[i];
      obj[toKr(col)] = (!isNaN(Number(v)) && v !== null && v !== "") ? Number(v) : v;
    });
    return obj;
  });

  // Donut: single row multi-value OR weight/ratio columns OR few items with one value col
  const isRatio = td.columns.some(c => c.includes("ratio") || c.includes("비중") || c.includes("weight") || c.includes("allocation"));
  if ((td.rows.length === 1 && numericCols.length >= 2) || (isRatio && td.rows.length <= 8)) {
    return { type: "donut", data, labelCol: toKr(labelCol), valueCols: numericCols.map(toKr) };
  }

  // Default: horizontal bar
  return { type: "hbar", data, labelCol: toKr(labelCol), valueCols: numericCols.map(toKr) };
}

function ChartRenderer({ chartInfo }: { chartInfo: ChartInfo }) {
  const { type, data, labelCol, valueCols } = chartInfo;

  if (type === "donut") {
    // Build pie data
    let pieData: { name: string; value: number }[] = [];
    if (data.length === 1) {
      pieData = valueCols.map(col => ({ name: col, value: Math.abs(Number(data[0][col]) || 0) }));
    } else {
      pieData = data.map(d => ({ name: String(d[labelCol] || ""), value: Math.abs(Number(d[valueCols[0]]) || 0) }));
    }
    // Group small values into "기타"
    const total = pieData.reduce((s, d) => s + d.value, 0);
    const threshold = total * 0.03;
    const main = pieData.filter(d => d.value >= threshold);
    const others = pieData.filter(d => d.value < threshold);
    if (others.length > 0) main.push({ name: "기타", value: others.reduce((s, d) => s + d.value, 0) });

    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={main} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} >
            {main.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => fmtNum(v)} contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #E5E7EB" }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "hbar") {
    return (
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: "#9CA3AF" }} tickFormatter={fmtAxis} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey={labelCol} tick={{ fontSize: 11, fill: "#4B5563" }} width={90} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: number) => fmtNum(v)} contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #E5E7EB" }} />
          {valueCols.slice(0, 2).map((col, i) => (
            <Bar key={col} dataKey={col} fill={COLORS[i]} radius={[0, 6, 6, 0]} barSize={20} />
          ))}
          {valueCols.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return null;
}

/* ===== History Panel ===== */
function HistoryPanel({ open, onClose, history, onSelect, onClear }: {
  open: boolean; onClose: () => void; history: string[]; onSelect: (q: string) => void; onClear: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button onClick={onClose} className="absolute inset-0 bg-black/40" />
      <aside className="absolute right-0 top-0 h-full w-[82%] max-w-[360px] bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
          <h2 className="text-[15px] font-semibold text-gray-800">최근 질문</h2>
          <button onClick={onClose} className="size-9 flex items-center justify-center rounded-full hover:bg-gray-50"><X className="size-5 text-gray-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {history.length === 0 ? (
            <p className="px-3 py-6 text-[13px] text-gray-400 text-center">질문 내역이 없습니다</p>
          ) : (
            <ul className="space-y-1">{history.map((q, i) => (
              <li key={`${q}-${i}`}><button onClick={() => onSelect(q)} className="w-full text-left px-3 py-2.5 rounded-xl text-[13.5px] text-gray-700 hover:bg-[#F8F9FF] transition-colors">{q}</button></li>
            ))}</ul>
          )}
        </div>
        {history.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <button onClick={onClear} className="w-full text-[13px] text-gray-400 hover:text-gray-600 py-2">전체 삭제</button>
          </div>
        )}
      </aside>
    </div>
  );
}
