import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, X, Info, Send, Menu, Mic, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useCustomer } from "@/lib/customer-context";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

type TableData = {
  columns: string[];
  rows: (string | number | null)[][];
};

type ChartType = "bar" | "line" | "pie" | "none";

type Msg =
  | { role: "user"; text: string }
  | { role: "bot"; text: string; sql?: string | null; tableData?: TableData | null };

const HISTORY_KEY = "aipb_chat_questions";
const COLORS = ["#606CF2", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#6366F1"];

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

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
      setMessages((prev) => [...prev, { role: "bot", text: "고객을 먼저 선택해주세요." }]);
      return;
    }
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    setHistory((prev) => {
      const next = [text, ...prev.filter((q) => q !== text)].slice(0, 30);
      try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          customer_id: customer.id,
          customer_name: customer.name,
          conversation_id: conversationId,
        }),
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      const data = await res.json();
      setConversationId(data.conversation_id);

      let tableData: TableData | null = null;
      if (data.table_data) {
        const td = data.table_data;
        if (td.columns && td.rows) {
          tableData = { columns: td.columns, rows: td.rows };
        } else if (td.data_array && td.schema) {
          tableData = { columns: td.schema.map((c: any) => c.name || c), rows: td.data_array };
        }
      }

      setMessages((prev) => [...prev, { role: "bot", text: data.answer || "응답을 받았습니다.", sql: data.sql, tableData }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "bot", text: `오류: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  const handleSend = () => { const t = input.trim(); if (!t) return; setInput(""); sendQuestion(t); };
  const hasMessages = messages.length > 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#E9EFFE" }}>
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col" style={{ backgroundColor: "#E9EFFE" }}>
        <header className="sticky top-0 z-10 backdrop-blur-md" style={{ backgroundColor: "#606CF2" }}>
          <div className="flex items-center justify-between px-3 h-14">
            <Link to="/" className="size-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white"><ChevronLeft className="size-5" /></Link>
            <span className="text-[16px] font-semibold tracking-tight text-white">AI PB 챗봇</span>
            <div className="flex items-center">
              <button onClick={() => setMenuOpen(true)} aria-label="질문 히스토리" className="size-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white"><Menu className="size-5" /></button>
              <Link to="/" className="size-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white"><X className="size-5" /></Link>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 pb-2">
            <User className="size-3.5 text-white/70" />
            <span className="text-[12px] text-white/80">{customer.name} 고객님 기준 답변</span>
          </div>
        </header>

        <HistoryPanel open={menuOpen} onClose={() => setMenuOpen(false)} history={history}
          onSelect={(q) => { setMenuOpen(false); sendQuestion(q); }}
          onClear={() => { setHistory([]); try { window.localStorage.removeItem(HISTORY_KEY); } catch {} }}
        />

        <main className="flex-1 px-5 pt-6 pb-4">
          <p className="text-[16px] leading-[1.55] text-foreground">
            AI 자산관리챗봇 <span className="font-bold text-[#606CF2]">AI PB</span>입니다.<br />
            {customer.name} 고객님의 데이터를 기준으로 답변해드려요.
          </p>
          <button className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground/80">AI PB 서비스 이용 유의사항 <Info className="size-3.5" /></button>

          {!hasMessages && (
            <div className="mt-6">
              <p className="text-[12.5px] text-muted-foreground/80 mb-2">이런 걸 물어볼 수 있어요</p>
              <div className="flex flex-wrap gap-2">
                {["내 포트폴리오 수익률은?", "보유 종목별 손익 알려줘", "내 자산 배분 현황은?", "최근 투자 변동 요약해줘"].map((q) => (
                  <button key={q} onClick={() => sendQuestion(q)} className="text-[13px] px-3.5 py-2 rounded-full bg-white border text-foreground hover:bg-white/80 transition-colors" style={{ borderColor: "#C9D3F5" }}>{q}</button>
                ))}
              </div>
            </div>
          )}

          {hasMessages && (
            <div className="mt-6 space-y-3">
              {messages.map((m, i) => m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] leading-[1.5] text-white" style={{ backgroundColor: "#606CF2" }}>{m.text}</div>
                </div>
              ) : ( <BotMessage key={i} msg={m} /> ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[90%] text-[14px] leading-[1.55] text-muted-foreground animate-pulse">💭 {customer.name} 고객님 데이터 조회 중...</div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </main>

        <div className="sticky bottom-0 px-4 pb-5 pt-3" style={{ backgroundColor: "#E9EFFE" }}>
          <div className="rounded-full p-px bg-gradient-to-r from-[#C9B5FF] via-[#A8C5FF] to-[#FFB8D8]">
            <div className="flex items-center gap-2 rounded-full bg-white pl-2 pr-1.5 py-1.5">
              <button type="button" aria-label="음성 입력" className="size-9 rounded-full flex items-center justify-center text-foreground/70 hover:bg-muted"><Mic className="size-[18px]" /></button>
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder="AI PB에게 물어보세요" className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/70 outline-none py-2" />
              <button onClick={handleSend} aria-label="전송" className="size-9 rounded-full flex items-center justify-center text-white bg-gradient-to-r from-[#C9B5FF] via-[#A8C5FF] to-[#FFB8D8]"><Send className="size-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Chart Type Inference ===== */
function inferChartType(columns: string[], rows: any[][]): ChartType {
  if (!columns.length || !rows.length) return "none";
  const numericCols = columns.filter((_, ci) => rows.some(r => typeof r[ci] === "number" || (!isNaN(Number(r[ci])) && r[ci] !== null && r[ci] !== "")));
  const stringCols = columns.filter((_, ci) => rows.some(r => typeof r[ci] === "string" && isNaN(Number(r[ci]))));

  // Single row with multiple numeric columns → pie chart (e.g., asset allocation)
  if (rows.length === 1 && numericCols.length >= 2) return "pie";
  // Column names suggest ratio/percentage → pie
  if (numericCols.length >= 2 && columns.some(c => c.includes("비중") || c.includes("ratio") || c.includes("weight") || c.includes("allocation"))) return "pie";
  // Date-like column + numeric → line chart
  if (stringCols.length >= 1 && numericCols.length >= 1 && columns.some(c => c.includes("date") || c.includes("날짜") || c.includes("month") || c.includes("기간"))) return "line";
  // Multiple rows with string + numeric → bar chart
  if (rows.length > 1 && stringCols.length >= 1 && numericCols.length >= 1) return "bar";
  // Single numeric column with many rows
  if (rows.length > 1 && numericCols.length >= 1) return "bar";
  return "none";
}

function buildChartData(columns: string[], rows: any[][]) {
  return rows.map(row => {
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => {
      const val = row[i];
      obj[col] = (!isNaN(Number(val)) && val !== null && val !== "") ? Number(val) : val;
    });
    return obj;
  });
}

/* ===== Bot Message with Rich Rendering ===== */
function BotMessage({ msg }: { msg: Msg & { role: "bot" } }) {
  const hasTable = msg.tableData && msg.tableData.columns.length > 0 && msg.tableData.rows.length > 0;
  const chartType = hasTable ? inferChartType(msg.tableData!.columns, msg.tableData!.rows) : "none";
  const chartData = hasTable ? buildChartData(msg.tableData!.columns, msg.tableData!.rows) : [];

  const numericCols = hasTable ? msg.tableData!.columns.filter((_, ci) => msg.tableData!.rows.some(r => !isNaN(Number(r[ci])) && r[ci] !== null && r[ci] !== "")) : [];
  const stringCols = hasTable ? msg.tableData!.columns.filter((_, ci) => msg.tableData!.rows.some(r => typeof r[ci] === "string" && isNaN(Number(r[ci])))) : [];
  const labelCol = stringCols[0] || msg.tableData?.columns[0] || "label";

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] space-y-3 w-full">
        {/* Text answer */}
        <div className="text-[14px] leading-[1.6] text-foreground whitespace-pre-wrap">{msg.text}</div>

        {/* Chart rendering */}
        {chartType !== "none" && (
          <div className="rounded-xl bg-white border border-border/50 shadow-sm p-3">
            <div className="text-[11px] font-medium text-muted-foreground mb-2">📊 시각화</div>
            <ResponsiveContainer width="100%" height={200}>
              {chartType === "bar" ? (
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4EAFB" />
                  <XAxis dataKey={labelCol} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  {numericCols.map((col, i) => (
                    <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              ) : chartType === "line" ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4EAFB" />
                  <XAxis dataKey={labelCol} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  {numericCols.map((col, i) => (
                    <Line key={col} type="monotone" dataKey={col} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              ) : (
                <PieChart>
                  <Pie data={chartType === "pie" && chartData.length === 1
                    ? numericCols.map((col, i) => ({ name: col, value: Number(chartData[0][col]) || 0 }))
                    : chartData.map((d, i) => ({ name: d[labelCol] || `Item ${i}`, value: Number(d[numericCols[0]]) || 0 }))}
                    cx="50%" cy="50%" innerRadius={40} outerRadius={75}
                    paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false} >
                    {(chartType === "pie" && chartData.length === 1 ? numericCols : chartData).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* Table rendering */}
        {hasTable && (
          <div className="rounded-xl bg-white border border-border/50 shadow-sm overflow-hidden">
            <div className="px-3 py-2 bg-[#F8F9FF] border-b border-border/30">
              <span className="text-[11px] font-medium text-muted-foreground">📋 데이터 테이블</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border/30">
                    {msg.tableData!.columns.map((col, ci) => (
                      <th key={ci} className="px-3 py-2 text-left font-semibold text-foreground/80 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {msg.tableData!.rows.slice(0, 10).map((row, ri) => (
                    <tr key={ri} className="border-b border-border/20 last:border-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-1.5 text-foreground/85 whitespace-nowrap">{cell ?? "-"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {msg.tableData!.rows.length > 10 && (
              <div className="px-3 py-1.5 text-[11px] text-muted-foreground text-center border-t border-border/30">외 {msg.tableData!.rows.length - 10}건</div>
            )}
          </div>
        )}

        {/* SQL (collapsed) */}
        {msg.sql && (
          <details className="text-[11px]">
            <summary className="text-muted-foreground/60 cursor-pointer hover:text-muted-foreground">실행된 SQL 보기</summary>
            <pre className="mt-1 p-2 rounded-lg bg-[#1e1e2e] text-[#cdd6f4] text-[10px] overflow-x-auto leading-relaxed">{msg.sql}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

/* ===== History Panel ===== */
function HistoryPanel({ open, onClose, history, onSelect, onClear }: {
  open: boolean; onClose: () => void; history: string[]; onSelect: (q: string) => void; onClear: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <aside className="absolute right-0 top-0 h-full w-[82%] max-w-[360px] bg-white shadow-xl flex flex-col" role="dialog" aria-label="질문 히스토리">
        <div className="flex items-center justify-between px-4 h-14 border-b" style={{ borderColor: "#E4EAFB" }}>
          <h2 className="text-[15px] font-semibold text-foreground">최근 질문</h2>
          <button onClick={onClose} aria-label="닫기" className="size-9 flex items-center justify-center rounded-full hover:bg-black/5 text-foreground/80"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {history.length === 0 ? (
            <p className="px-3 py-6 text-[13px] text-muted-foreground text-center">아직 질문 내역이 없어요.</p>
          ) : (
            <ul className="space-y-1">{history.map((q, i) => (
              <li key={`${q}-${i}`}><button onClick={() => onSelect(q)} className="w-full text-left px-3 py-2.5 rounded-lg text-[13.5px] leading-[1.5] text-foreground hover:bg-[#F2F5FE] transition-colors">{q}</button></li>
            ))}</ul>
          )}
        </div>
        {history.length > 0 && (
          <div className="px-4 py-3 border-t" style={{ borderColor: "#E4EAFB" }}>
            <button onClick={onClear} className="w-full text-[13px] text-muted-foreground hover:text-foreground py-2">전체 기록 삭제</button>
          </div>
        )}
      </aside>
    </div>
  );
}
