import { tagClassName } from "./tag-style";
import { TrendingUp, TrendingDown, X, ChevronDown } from "lucide-react";
import { AiChatCta } from "./AiChatCta";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";

export type Master = {
  emoji: string;
  name: string;
  note: string;
  action: "매수" | "매도";
};

export type HistoryEvent = {
  date: string;
  change: string;
  direction: "up" | "down";
  text: string;
};

export type HoldingDetailContentProps = {
  tag?: string;
  title?: string;
  summaryIcon?: string;
  summaryLabel?: string;
  summary?: string;
  summarySub?: string;
  reasonsIcon?: string;
  reasonsLabel?: string;
  reasons?: string[];
  sources?: string[];
  buyCount?: number;
  sellCount?: number;
  masters?: Master[];
  hideMasters?: boolean;
  hideMasterDetails?: boolean;
  aiPbSummary?: string;
  pollLabel?: string;
  mastersDefaultOpen?: boolean;
  history?: HistoryEvent[];
  chart?: {
    title?: string;
    gap?: string;
    data: { label: string; kospi: number; fund: number }[];
    fundLabel?: string;
    caption?: string;
  };
  /** 채팅 인라인 모드: 닫기 버튼/AiChatCta 숨김 */
  inChat?: boolean;
  onClose?: () => void;
  onGoChat?: () => void;
};

export function BuyGauge({ buyCount, sellCount, pollLabel }: { buyCount: number; sellCount: number; pollLabel?: string }) {
  const total = buyCount + sellCount;
  const pct = total > 0 ? buyCount / total : 0.5;
  const buyPct = Math.round(pct * 100);
  const label = pollLabel ?? (sellCount === 0 ? "전원 매수" : buyCount > sellCount ? "매수 우위" : buyCount < sellCount ? "매도 우위" : "매수·매도 균형");
  const cx = 100;
  const cy = 95;
  const r = 72;
  const strokeW = 16;
  const pt = (a: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  const boundaryAngle = Math.PI + pct * Math.PI;
  const leftStart = pt(Math.PI);
  const boundary = pt(boundaryAngle);
  const rightEnd = pt(2 * Math.PI);
  const buyPath = `M ${leftStart.x} ${leftStart.y} A ${r} ${r} 0 0 1 ${boundary.x} ${boundary.y}`;
  const sellPath = `M ${boundary.x} ${boundary.y} A ${r} ${r} 0 0 1 ${rightEnd.x} ${rightEnd.y}`;
  const needleLen = r - 4;
  const needleTip = { x: cx + needleLen * Math.cos(boundaryAngle), y: cy + needleLen * Math.sin(boundaryAngle) };
  const isBuy = buyCount >= sellCount;
  const accent = isBuy ? "text-[color:var(--pos)]" : "text-[color:var(--neg)]";

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 118" className="w-full max-w-[200px]">
        {pct > 0 && (
          <path d={buyPath} stroke="var(--pos)" strokeWidth={strokeW} fill="none" strokeLinecap="round" />
        )}
        {pct < 1 && (
          <path d={sellPath} stroke="var(--neg)" strokeWidth={strokeW} fill="none" strokeLinecap="round" />
        )}
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke="oklch(0.25 0.01 260)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={4.5} fill="oklch(0.25 0.01 260)" />
      </svg>
      <div className="-mt-3 flex flex-col items-center">
        <div className={`text-[11.5px] font-semibold ${accent}`}>{label}</div>
        <div className="mt-1 text-[18px] font-extrabold tracking-tight text-foreground leading-none">
          매수 <span className="text-[color:var(--pos)]">{buyCount}</span>
          <span className="text-muted-foreground/60 mx-1.5 text-[13px] font-bold">vs</span>
          매도 <span className="text-[color:var(--neg)]">{sellCount}</span>
        </div>
        <div className="mt-1.5 text-[10.5px] font-semibold text-muted-foreground">
          BUY <span className={accent}>{buyPct}%</span>
        </div>
      </div>
    </div>
  );
}

export function HoldingDetailContent({
  tag = "보유",
  title = "삼성전자",
  summaryIcon = "🤖",
  summaryLabel = "AI가 내린 결론",
  summary = "외국인 투자자들이 많이 사들이고 있어요.",
  summarySub = "외국인 순매수가 최근 4일 연속 이어지고 있어요.",
  reasonsIcon = "🔍",
  reasonsLabel = "왜 이런 변화가 생겼을까요?",
  reasons = [
    "미국 정부의 AI 서버 투자 확대 기대가 반영되며 메모리 수요 증가 전망이 나오고 있어요.",
    "이에 따라 실적 개선 기대가 커지면서 외국인 매수가 유입되고 있어요.",
    "주가는 아직 제한적인 흐름을 보이고 있어요.",
  ],
  sources,
  buyCount = 2,
  sellCount = 1,
  masters,
  hideMasters = false,
  hideMasterDetails = false,
  aiPbSummary,
  pollLabel,
  mastersDefaultOpen = false,
  history,
  chart,
  inChat = false,
  onClose,
  onGoChat,
}: HoldingDetailContentProps) {
  const [showMasters, setShowMasters] = useState(mastersDefaultOpen);
  const defaultMasters: Master[] = [
    { emoji: "🔥", name: "공격형 고수", note: "추가 매수 진행 중", action: "매수" },
    { emoji: "💎", name: "장기형 고수", note: "장기 보유 유지", action: "매수" },
    { emoji: "🏅", name: "금상 고수", note: "일부 차익 실현", action: "매도" },
  ];
  const mastersList = masters ?? defaultMasters;

  return (
    <div className={inChat ? "px-6 pt-4 pb-3 space-y-7" : "px-6 pt-4 pb-3 space-y-7 max-h-[78vh] overflow-y-auto"}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${tagClassName(tag)}`}>{tag}</span>
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">{title}</h2>
        </div>
        {!inChat && onClose && (
          <button onClick={onClose} aria-label="닫기"
            className="size-8 -mr-1 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors">
            <X className="size-4.5" />
          </button>
        )}
      </div>

      {/* AI가 내린 결론 */}
      <section className="space-y-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
          <span>{summaryIcon}</span><span>{summaryLabel}</span>
        </div>
        <p className="text-[16px] font-bold text-foreground leading-snug">{summary}</p>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed">{summarySub}</p>
      </section>

      {/* 비교 차트 */}
      {chart && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
              <span>📉</span><span>{chart.title ?? "코스피 대비 수익률 (최근 1개월)"}</span>
            </div>
            {chart.gap && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[color:var(--info-soft)] text-[color:var(--info)]">
                <TrendingDown className="size-3" /> 격차 {chart.gap}
              </span>
            )}
          </div>
          <div className="rounded-2xl border border-border/60 bg-card px-3 pt-3 pb-2">
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart.data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="oklch(0.9 0.005 260)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.55 0.02 260)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "oklch(0.55 0.02 260)" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}%`} domain={[-6, 6]} ticks={[-6, -3, 0, 3, 6]} />
                  <Legend verticalAlign="bottom" height={20} iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="kospi" name="코스피" stroke="oklch(0.25 0.01 260)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fund" name={chart.fundLabel ?? title} stroke="var(--brand)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {chart.caption && <p className="text-[12.5px] text-muted-foreground leading-relaxed pt-1">{chart.caption}</p>}
        </section>
      )}

      {/* 이유 */}
      <section className="space-y-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
          <span>{reasonsIcon}</span><span>{reasonsLabel}</span>
        </div>
        <div className="rounded-2xl bg-muted/40 px-4 py-3.5 space-y-2.5">
          <ul className="space-y-2 text-[14px] text-foreground/90 leading-relaxed">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground/60 mt-1.5 size-1 rounded-full bg-current shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          {sources && sources.length > 0 && (
            <div className="pt-1 text-[11.5px] text-muted-foreground">
              출처 ·{" "}
              {sources.map((s, i) => (
                <span key={s}>
                  <a className="underline-offset-2 hover:underline text-[color:var(--brand)]">{s}↗</a>
                  {i < sources.length - 1 ? " " : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 히스토리 */}
      {history && history.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
            <span>📈</span><span>예전에는 이런 일이 일어났어요</span>
          </div>
          <ol className="relative space-y-2.5 pl-4">
            <span className="absolute left-1.5 top-2 bottom-2 w-px bg-border" />
            {history.map((h, i) => {
              const isUp = h.direction === "up";
              return (
                <li key={i} className="relative">
                  <span className={`absolute -left-[11px] top-3 size-2 rounded-full ring-2 ring-background ${
                    isUp ? "bg-[color:var(--pos)]" : "bg-[color:var(--neg)]"
                  }`} />
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-semibold text-muted-foreground tabular-nums">{h.date}</span>
                      <span className={`inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full ${
                        isUp ? "bg-[color:var(--pos-soft)] text-[color:var(--pos)]" : "bg-[color:var(--neg-soft)] text-[color:var(--neg)]"
                      }`}>
                        {isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                        {h.change}
                      </span>
                    </div>
                    <p className="text-[13px] text-foreground/90 leading-relaxed">{h.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* 고수들의 평가 */}
      {!hideMasters && (
        <section>
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
                <span>🏆</span><span>고수들은 어제까지 이 종목을 이렇게 거래했어요</span>
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground/80 leading-relaxed">어떤 흐름이 있었는지 한눈에 확인해보세요</p>
            </div>
            <div className="h-px bg-border/60 mx-4" />
            <div className="px-4 pt-4 pb-2">
              <BuyGauge buyCount={buyCount} sellCount={sellCount} pollLabel={pollLabel} />
            </div>
            {aiPbSummary && (
              <>
                <div className="h-px bg-border/60 mx-4" />
                <div className="px-4 py-3 flex gap-2">
                  <span className="text-[14px]">🤖</span>
                  <div className="text-[13px] leading-relaxed">
                    <div className="font-semibold text-foreground/90 mb-0.5">AI PB 한줄 요약</div>
                    <p className="text-foreground/80">{aiPbSummary}</p>
                  </div>
                </div>
              </>
            )}
            {!hideMasterDetails && (
              <>
                <div className="h-px bg-border/60 mx-4" />
                <button onClick={() => setShowMasters((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                  <span className="text-[13px] font-semibold text-foreground">고수 자세히 보기</span>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform ${showMasters ? "rotate-180" : ""}`} />
                </button>
                {showMasters && (
                  <div className="px-4 pb-4 grid grid-cols-1 gap-2">
                    {mastersList.map((m, i) => {
                      const isBuy = m.action === "매수";
                      return (
                        <div key={i} className="flex items-center justify-between rounded-xl border border-border/60 px-3.5 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`size-7 rounded-full flex items-center justify-center text-[13px] ${
                              isBuy ? "bg-[color:var(--pos-soft)]" : "bg-[color:var(--neg-soft)]"
                            }`}>{m.emoji}</span>
                            <div>
                              <div className="text-[13px] font-semibold text-foreground">{m.name}</div>
                              <div className="text-[11.5px] text-muted-foreground">{m.note}</div>
                            </div>
                          </div>
                          <span className={`flex items-center gap-1 text-[12px] font-bold ${
                            isBuy ? "text-[color:var(--pos)]" : "text-[color:var(--neg)]"
                          }`}>
                            {isBuy ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />} {m.action}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {!inChat && onGoChat && <AiChatCta onClick={onGoChat} />}
    </div>
  );
}
