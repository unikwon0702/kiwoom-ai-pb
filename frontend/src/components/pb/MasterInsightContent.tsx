import { useRef, useState, useEffect } from "react";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

// ====== Constants ======
const ACCENT_MAP: Record<string, string> = {
  "공격형 투자": "#F97316",
  "장기형 투자": "#3B82F6",
  "금상": "#EAB308",
};
const SECTOR_COLORS = ["#3B5BFF", "#6BB6FF", "#9BC8FF", "#C5DCFF", "#E0E9FF", "#D4D4D4"];

type Master = { name: string; emoji: string; accent: string; short: string; traits: string[] };
type Pick = { ticker: string; weight: number };
type DailyPick = { master: Master; date: string; buys: Pick[]; sells: Pick[] };
type Portfolio = {
  master: Master; totalKRW: string; avgHoldings: string; turnover: string;
  domesticRatio: number; sectorAllocation: { label: string; value: number; color: string }[];
  domesticTop: { label: string; value: number }[];
  overseasTop: { label: string; value: number }[];
};

const masters_default: Master[] = [
  { name: "공격형 고수", emoji: "🔥", accent: ACCENT_MAP["공격형 투자"], short: "단기 모멘텀 중심, 고수익 추구", traits: ["공격형 투자", "단기 매매", "변동성 허용"] },
  { name: "장기형 고수", emoji: "💎", accent: ACCENT_MAP["장기형 투자"], short: "장기 가치 중심, 안정 추구", traits: ["장기형 투자", "가치투자", "저회전율"] },
  { name: "금상 고수", emoji: "🏅", accent: ACCENT_MAP["금상"], short: "균형 잡힌 포트폴리오 관리", traits: ["금상", "균형형", "섹터 분산"] },
];

function buildMasters(investors: any[]): Master[] {
  if (!investors.length) return masters_default;
  return investors.map((inv, i) => ({
    ...masters_default[i] ?? masters_default[0],
  }));
}

function buildDailyPicks(investors: any[], masters: Master[]): DailyPick[] {
  return investors.map((inv, i) => {
    const _buyStr = inv.daily_buy_tickers ?? inv.daily_buys_json;
    const _sellStr = inv.daily_sell_tickers ?? inv.daily_sells_json;
    const buyRaw = _buyStr ? (typeof _buyStr === "string" ? JSON.parse(_buyStr) : _buyStr) : [];
    const sellRaw = _sellStr ? (typeof _sellStr === "string" ? JSON.parse(_sellStr) : _sellStr) : [];
    const buys: Pick[] = buyRaw.map((t: any) => ({ ticker: typeof t === "string" ? t : t.ticker ?? t.asset_name ?? "?", weight: typeof t === "object" ? (t.weight ?? 20) : 20 }));
    const sells: Pick[] = sellRaw.map((t: any) => ({ ticker: typeof t === "string" ? t : t.ticker ?? t.asset_name ?? "?", weight: typeof t === "object" ? (t.weight ?? 20) : 20 }));
    const dateStr = inv.signal_date ? new Date(inv.signal_date).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", weekday: "short" }) : "최근";
    return { master: masters[i] ?? masters[0], date: dateStr, buys, sells };
  });
}

function buildPortfolios(investors: any[], masters: Master[]): Portfolio[] {
  return investors.map((inv, i) => {
    const sectorRaw = inv.sector_allocation_json ? JSON.parse(inv.sector_allocation_json) : {};
    const domesticRaw = inv.domestic_top_json ? JSON.parse(inv.domestic_top_json) : [];
    const overseasRaw = inv.overseas_top_json ? JSON.parse(inv.overseas_top_json) : [];
    const sectorAllocation = Object.entries(sectorRaw)
      .filter(([k]) => k !== "top_sector")
      .map(([label, value], idx) => ({
        label: label === "stock" ? "주식" : label === "fund" ? "펀드" : label === "bond" ? "채권" : label,
        value: Number(value) || 0,
        color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
      })).filter((s) => s.value > 0);
    if (sectorAllocation.length === 0) sectorAllocation.push({ label: sectorRaw.top_sector ?? "기타", value: 100, color: SECTOR_COLORS[0] });
    const domesticTop = domesticRaw.map((d: any) => ({ label: d.asset_name ?? d.label ?? "", value: d.return_pct ?? d.value ?? 0 }));
    const overseasTop = overseasRaw.length > 0
      ? overseasRaw.map((d: any) => ({ label: d.asset_name ?? d.label ?? "", value: d.return_pct ?? d.value ?? 0 }))
      : [{ label: "해외 자산 없음", value: 0 }];
    return {
      master: masters[i] ?? masters[0],
      totalKRW: inv.total_asset_krw ?? "—", avgHoldings: inv.avg_holdings ? `${inv.avg_holdings}개` : "—", turnover: "—",
      domesticRatio: 70, sectorAllocation, domesticTop, overseasTop,
    };
  });
}

function Carousel<T>({ items, renderItem }: { items: T[]; renderItem: (item: T, idx: number) => React.ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => { const idx = Math.round(el.scrollLeft / el.clientWidth); setActiveIdx(idx); };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  const scrollTo = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
  };
  return (
    <div className="space-y-2.5">
      <div className="relative">
        <div ref={scrollerRef} className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-6 px-6 gap-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, i) => (<div key={i} className="snap-center shrink-0 w-full">{renderItem(item, i)}</div>))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2.5">
        <button onClick={() => scrollTo(Math.max(0, activeIdx - 1))} disabled={activeIdx === 0} aria-label="이전" className="size-6 rounded-full flex items-center justify-center text-muted-foreground disabled:opacity-30"><ChevronLeft className="size-4" /></button>
        <div className="flex items-center gap-1.5">
          {items.map((_, i) => (<button key={i} onClick={() => scrollTo(i)} aria-label={`${i + 1}번째`} className={`size-1.5 rounded-full transition-all ${i === activeIdx ? "bg-foreground w-4" : "bg-muted-foreground/30"}`} />))}
        </div>
        <button onClick={() => scrollTo(Math.min(items.length - 1, activeIdx + 1))} disabled={activeIdx === items.length - 1} aria-label="다음" className="size-6 rounded-full flex items-center justify-center text-muted-foreground disabled:opacity-30"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  );
}

function mockQuote(ticker: string, weight: number, tone: "buy" | "sell") {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) >>> 0;
  const price = 10000 + (h % 240000);
  const base = (h % 70) / 10 + 0.4;
  const pct = tone === "buy" ? +(base + weight / 30).toFixed(2) : -+(base + weight / 40).toFixed(2);
  const notes = tone === "buy"
    ? ["거래량 급증, 단기 모멘텀 강화", "외국인 순매수 유입세 지속", "실적 기대감, 업종 내 상대강도 상승"]
    : ["단기 과열, 차익실현 압력", "수급 약화, 추세 둔화 감지", "리스크 헤지 차원 정리"];
  return { price, pct, note: notes[h % notes.length] };
}

function BubbleMap({ picks, tone }: { picks: Pick[]; tone: "buy" | "sell" }) {
  const isBuy = tone === "buy";
  const baseColor = isBuy ? "var(--pos)" : "var(--neg)";
  const softColor = isBuy ? "var(--pos-soft)" : "var(--neg-soft)";
  if (picks.length === 0) {
    return <div className="relative h-[200px] rounded-2xl bg-muted/30 flex items-center justify-center"><p className="text-[13px] text-muted-foreground">{isBuy ? "매수" : "매도"} 데이터 없음</p></div>;
  }
  return (
    <div className="relative h-[200px] rounded-2xl bg-muted/30 overflow-hidden">
      {picks.map((p, i) => {
        const size = 42 + (p.weight / 100) * 70;
        const positions = [{ left: "50%", top: "50%" }, { left: "32%", top: "32%" }, { left: "68%", top: "34%" }, { left: "34%", top: "70%" }, { left: "68%", top: "70%" }, { left: "50%", top: "20%" }];
        const pos = positions[i] ?? { left: "50%", top: "50%" };
        const q = mockQuote(p.ticker, p.weight, tone);
        return (
          <Popover key={i}>
            <PopoverTrigger asChild>
              <button type="button" className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center text-center px-1.5 font-bold border-2 cursor-pointer transition-transform active:scale-95 hover:scale-105"
                style={{ left: pos.left, top: pos.top, width: size, height: size, backgroundColor: `color-mix(in oklab, ${baseColor} ${Math.min(p.weight * 1.4, 90)}%, white)`, borderColor: baseColor, color: p.weight > 30 ? "white" : `color-mix(in oklab, ${baseColor} 70%, black)`, fontSize: Math.max(8.5, Math.min(11, size / 9)), lineHeight: 1.1 }}>
                <span className="line-clamp-2 break-keep">{p.ticker}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="center" className="w-60 p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-foreground truncate">{p.ticker}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: softColor, color: baseColor }}>{isBuy ? "매수" : "매도"}</span>
                </div>
                <div className="flex items-end justify-between">
                  <div><div className="text-[10.5px] text-muted-foreground">현재가</div><div className="text-[14px] font-bold text-foreground">{q.price.toLocaleString()}원</div></div>
                  <div className="text-right"><div className="text-[10.5px] text-muted-foreground">수익률</div><div className="text-[14px] font-bold" style={{ color: q.pct >= 0 ? "var(--pos)" : "var(--neg)" }}>{q.pct >= 0 ? "+" : ""}{q.pct}%</div></div>
                </div>
                <div className="flex items-start gap-1.5 rounded-lg bg-muted/60 p-2">
                  <Sparkles className="size-3 mt-0.5 shrink-0 text-[color:var(--brand)]" />
                  <p className="text-[11.5px] leading-snug text-foreground">{q.note}</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
      <div className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none" style={{ backgroundColor: softColor, color: baseColor }}>{isBuy ? "매수" : "매도"}</div>
    </div>
  );
}

function MiniDonut({ data, side }: { data: { label: string; value: number }[]; side: "국내" | "해외" }) {
  const colors = ["#3B5BFF", "#6BB6FF", "#9BC8FF", "#C5DCFF", "#E0E9FF", "#D4D4D4"];
  const [selected, setSelected] = useState<number | null>(null);
  const sel = selected != null ? data[selected] : null;
  return (
    <Popover open={selected != null} onOpenChange={(o) => !o && setSelected(null)}>
      <PopoverTrigger asChild>
        <div className="h-[120px] w-full cursor-pointer">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={data} dataKey="value" innerRadius="55%" outerRadius="95%" paddingAngle={1} stroke="none" onClick={(_, idx) => setSelected(idx)}>
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} style={{ cursor: "pointer", outline: "none" }} opacity={selected != null && selected !== i ? 0.45 : 1} />)}
            </Pie></PieChart>
          </ResponsiveContainer>
        </div>
      </PopoverTrigger>
      {sel && (<PopoverContent side="top" align="center" className="w-52 p-3">
        <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-bold text-foreground truncate">{sel.label}</span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{side}</span></div>
        <div className="text-[14px] font-bold text-foreground mt-1">{sel.value}%</div>
      </PopoverContent>)}
    </Popover>
  );
}

function DailyPickCard({ pick: d }: { pick: DailyPick }) {
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const isBuy = mode === "buy";
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-8 shrink-0 rounded-full flex items-center justify-center text-[14px]" style={{ backgroundColor: `color-mix(in oklab, ${d.master.accent} 14%, white)` }}>{d.master.emoji}</span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold text-foreground leading-tight truncate">{d.master.name}의 데일리 픽</div>
            <div className="text-[10.5px] text-muted-foreground">{d.date}</div>
          </div>
        </div>
        <div className="relative flex shrink-0 rounded-full bg-muted p-0.5 text-[11px] font-bold">
          <div className="absolute top-0.5 bottom-0.5 w-1/2 rounded-full bg-background shadow-sm transition-transform" style={{ transform: isBuy ? "translateX(0%)" : "translateX(100%)" }} />
          <button onClick={() => setMode("buy")} className="relative z-10 px-3 py-1 flex items-center gap-1" style={{ color: isBuy ? "var(--pos)" : "hsl(var(--muted-foreground))" }}><TrendingUp className="size-3" />매수</button>
          <button onClick={() => setMode("sell")} className="relative z-10 px-3 py-1 flex items-center gap-1" style={{ color: !isBuy ? "var(--neg)" : "hsl(var(--muted-foreground))" }}><TrendingDown className="size-3" />매도</button>
        </div>
      </div>
      <BubbleMap picks={isBuy ? d.buys : d.sells} tone={mode} />
    </div>
  );
}

export type MasterInsightContentProps = {
  investors: any[];
  loading?: boolean;
  filterType?: string;
  inChat?: boolean;
  onClose?: () => void;
};

export function MasterInsightContent({ investors, loading = false, filterType, inChat = false, onClose }: MasterInsightContentProps) {
  const mastersData = buildMasters(investors);
  const dailyPicks = buildDailyPicks(investors, mastersData);
  const portfolios = buildPortfolios(investors, mastersData);

  const filteredMasters = filterType ? mastersData.filter((m) => m.traits.includes(filterType)) : mastersData;
  const filteredPicks = filterType ? dailyPicks.filter((d) => d.master.traits.includes(filterType)) : dailyPicks;
  const filteredPortfolios = filterType ? portfolios.filter((p) => p.master.traits.includes(filterType)) : portfolios;

  return (
    <div className={inChat ? "px-6 pt-4 pb-3 space-y-7" : "px-6 pt-4 pb-3 space-y-7 max-h-[78vh] overflow-y-auto"}>
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-bold tracking-tight text-foreground leading-snug">
          고수들은 최근에<br />이렇게 움직이고 있어요
        </h2>
        {!inChat && onClose && (
          <button onClick={onClose} aria-label="닫기" className="size-8 -mr-1 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60">
            <X className="size-4" />
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-[13px] text-muted-foreground py-8 text-center">불러오는 중...</p>
      ) : (
        <>
          {/* 고수들의 특징 */}
          <section className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-[17px] font-extrabold tracking-tight text-foreground">고수들의 특징</h3>
              <p className="text-[12.5px] text-muted-foreground leading-relaxed">투자고수는 스타일에 따라 3가지 유형으로 나뉘어요</p>
            </div>
            <div className="space-y-2.5">
              {filteredMasters.map((m) => (
                <div key={m.name} className="rounded-2xl border border-border/60 bg-card p-4 flex items-start gap-3">
                  <span className="size-10 shrink-0 rounded-full flex items-center justify-center text-[18px]" style={{ backgroundColor: `color-mix(in oklab, ${m.accent} 14%, white)` }}>{m.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold text-foreground leading-tight">{m.name}</div>
                    <p className="mt-1 text-[12px] text-muted-foreground leading-snug">{m.short}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.traits.map((t) => (<span key={t} className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-foreground/70">{t}</span>))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 데일리 픽 */}
          {filteredPicks.length > 0 && (
            <section className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-[17px] font-extrabold tracking-tight text-foreground">투자고수의 데일리 픽</h3>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">각 고수가 어제 가장 많이 거래한 종목이에요</p>
              </div>
              <Carousel items={filteredPicks} renderItem={(d) => <DailyPickCard pick={d} />} />
            </section>
          )}

          {/* 포트폴리오 분석 */}
          {filteredPortfolios.length > 0 && (
            <section className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-[17px] font-extrabold tracking-tight text-foreground">투자고수의 포트폴리오 분석</h3>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">각 고수가 어떤 자산을 보유하고 있는지 살펴보세요</p>
              </div>
              <Carousel
                items={filteredPortfolios}
                renderItem={(p) => (
                  <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3.5">
                    <div className="flex items-center gap-2">
                      <span className="size-8 rounded-full flex items-center justify-center text-[14px]" style={{ backgroundColor: `color-mix(in oklab, ${p.master.accent} 14%, white)` }}>{p.master.emoji}</span>
                      <div>
                        <div className="text-[13.5px] font-bold text-foreground leading-tight">{p.master.name}의 포트폴리오</div>
                        <div className="text-[10.5px] text-muted-foreground">보유 상품 분석</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ label: "주식 평가금액", value: p.totalKRW }, { label: "평균 보유종목수", value: p.avgHoldings }, { label: "회전율", value: p.turnover }].map((s) => (
                        <div key={s.label} className="rounded-xl bg-muted/40 px-2 py-2 text-center">
                          <div className="text-[10px] text-muted-foreground">{s.label}</div>
                          <div className="text-[14px] font-extrabold text-foreground mt-0.5">{s.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex h-2.5 rounded-full overflow-hidden">
                        <div className="bg-[#3B5BFF]" style={{ width: `${p.domesticRatio}%` }} />
                        <div className="bg-[#E22D72]" style={{ width: `${100 - p.domesticRatio}%` }} />
                      </div>
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-[#3B5BFF]">국내 {p.domesticRatio}%</span>
                        <span className="text-[#E22D72]">해외 {100 - p.domesticRatio}%</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex h-2 rounded-full overflow-hidden">
                        {p.sectorAllocation.map((s, i) => <div key={i} style={{ width: `${s.value}%`, backgroundColor: s.color }} />)}
                      </div>
                      <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[10.5px]">
                        {p.sectorAllocation.map((s) => (
                          <div key={s.label} className="flex items-center gap-1">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className="text-foreground/80 font-medium">{s.label} {s.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {[{ title: "국내", data: p.domesticTop, accent: "#3B5BFF" }, { title: "해외", data: p.overseasTop, accent: "#E22D72" }].map((side) => (
                        <div key={side.title} className="rounded-xl bg-muted/30 p-2.5 space-y-1.5">
                          <div className="text-[11px] font-bold" style={{ color: side.accent }}>{side.title}</div>
                          <MiniDonut data={side.data} side={side.title as "국내" | "해외"} />
                          <div className="space-y-0.5">
                            {side.data.slice(0, 5).map((d) => (
                              <div key={d.label} className="flex items-center justify-between text-[10px]">
                                <span className="text-foreground/80 truncate pr-1">{d.label}</span>
                                <span className="font-semibold text-foreground tabular-nums">{d.value}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
