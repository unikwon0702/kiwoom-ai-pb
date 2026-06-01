import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer";
import { Drawer as DrawerPrimitive } from "vaul";
import { useNavigate } from "@tanstack/react-router";
import { tagClassName } from "./tag-style";
import { X, ChevronDown, ChevronUp, CalendarClock, TrendingUp, TrendingDown } from "lucide-react";
import { AiChatCta } from "./AiChatCta";
import { useState } from "react";
import { formatDemoRelativeTime } from "@/lib/date";

type ReturnPoint = { label: string; value: number };
type TimelineEvent = {
  date: string;
  text: string;
  impact?: { dir: "up" | "down"; value: string; note: string };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: string;
  title?: string;
};

const RETURNS: Record<"1M" | "3M" | "6M" | "1Y", ReturnPoint[]> = {
  "1M": [
    { label: "1주", value: 0.4 },
    { label: "2주", value: 1.1 },
    { label: "3주", value: 0.8 },
    { label: "4주", value: 2.3 },
  ],
  "3M": [
    { label: "1M", value: -0.6 },
    { label: "2M", value: 1.5 },
    { label: "3M", value: 3.4 },
  ],
  "6M": [
    { label: "1M", value: -2.1 },
    { label: "2M", value: 0.4 },
    { label: "3M", value: 1.8 },
    { label: "4M", value: 3.2 },
    { label: "5M", value: 4.1 },
    { label: "6M", value: 6.7 },
  ],
  "1Y": [
    { label: "1Q", value: -3.2 },
    { label: "2Q", value: 2.4 },
    { label: "3Q", value: 5.6 },
    { label: "4Q", value: 9.8 },
  ],
};

const TIMELINE: TimelineEvent[] = [
  {
    date: formatDemoRelativeTime(0),
    text: "외국인 투자자들이 많이 사들이고 있어요",
    impact: { dir: "up", value: "+1.8%", note: "외국인 순매수 유입으로 단기 수급 개선" },
  },
  {
    date: formatDemoRelativeTime(5),
    text: "순매수가 8일 연속 이어지고 있어요",
    impact: { dir: "up", value: "+0.9%", note: "연속 순매수로 거래대금 상위 종목 진입" },
  },
  {
    date: formatDemoRelativeTime(9),
    text: "주가가 최근 최고치를 경신했어요",
    impact: { dir: "up", value: "+2.4%", note: "52주 신고가 경신, 매수세 강화" },
  },
  {
    date: formatDemoRelativeTime(12),
    text: "운용성과가 기대만큼 나오지 않았어요",
    impact: { dir: "down", value: "-1.3%", note: "실적 기대치 하회로 단기 차익실현" },
  },
  {
    date: formatDemoRelativeTime(14),
    text: "메모리 반도체 가격 반등 신호가 나왔어요",
    impact: { dir: "up", value: "+1.5%", note: "DRAM 현물가 상승, 업황 개선 기대" },
  },
  {
    date: formatDemoRelativeTime(15),
    text: "외국계 증권사가 목표주가를 상향 조정했어요",
    impact: { dir: "up", value: "+1.1%", note: "투자의견 상향에 따른 매수세 유입" },
  },
];

function MiniChart({ data }: { data: ReturnPoint[] }) {
  const w = 320;
  const h = 120;
  const padX = 8;
  const padY = 14;
  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const stepX = (w - padX * 2) / Math.max(1, data.length - 1);
  const y = (v: number) => h - padY - ((v - min) / range) * (h - padY * 2);
  const pts = data.map((d, i) => [padX + i * stepX, y(d.value)] as const);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${path} L${pts[pts.length - 1][0]},${h - padY} L${pts[0][0]},${h - padY} Z`;
  const last = data[data.length - 1].value;
  const up = last >= 0;
  const stroke = up ? "#10b981" : "#f43f5e";
  const fill = up ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)";
  const zeroY = y(0);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[120px]" preserveAspectRatio="none">
        <line x1={padX} x2={w - padX} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 3" />
        <path d={area} fill={fill} />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, py], i) => (
          <circle key={i} cx={x} cy={py} r={2.5} fill={stroke} />
        ))}
      </svg>
      <div className="flex justify-between mt-1 px-1">
        {data.map((d, i) => (
          <span key={i} className="text-[10.5px] text-muted-foreground tabular-nums">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function ProductHistoryDialog({
  open,
  onOpenChange,
  tag = "주식",
  title = "삼성전자",
}: Props) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"1M" | "3M" | "6M" | "1Y">("3M");
  const [showAll, setShowAll] = useState(false);

  const data = RETURNS[period];
  const last = data[data.length - 1].value;
  const up = last >= 0;
  const PREVIEW_COUNT = 3;
  const visibleTimeline = showAll ? TIMELINE : TIMELINE.slice(0, PREVIEW_COUNT);

  const goChat = () => {
    onOpenChange(false);
    navigate({ to: "/chat", search: {} });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[24px] border bg-background max-w-[480px] mx-auto focus:outline-none"
        >
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 rounded-full bg-muted" />

          <DrawerPrimitive.Title className="sr-only">{title} 상세</DrawerPrimitive.Title>

          <div className="px-6 pt-4 pb-3 space-y-7 max-h-[78vh] overflow-y-auto">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${tagClassName(tag)}`}>
                  {tag}
                </span>
                <h2 className="text-[18px] font-bold tracking-tight text-foreground">{title}</h2>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                aria-label="닫기"
                className="size-8 -mr-1 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <X className="size-4.5" />
              </button>
            </div>

            {/* 수익률 차트 */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
                  <span>📊</span>
                  <span>수익률 차트</span>
                </div>
                <span
                  className={`text-[13px] font-bold tabular-nums ${up ? "text-[color:var(--pos)]" : "text-[color:var(--neg)]"}`}
                >
                  {up ? "+" : ""}
                  {last.toFixed(1)}%
                </span>
              </div>

              <div className="rounded-2xl bg-muted/40 p-4 space-y-3 text-muted-foreground">
                <MiniChart data={data} />
              </div>

              <div className="flex gap-1.5">
                {(["1M", "3M", "6M", "1Y"] as const).map((p) => {
                  const active = p === period;
                  return (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`flex-1 text-[12.5px] font-semibold py-2 rounded-full border transition-colors ${
                        active
                          ? "bg-foreground text-background border-foreground"
                          : "bg-card text-muted-foreground border-border/70 hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 알림 정리: 예정된 이벤트 + 이전 변화 묶음 */}
            <section className="space-y-3">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
                <span>🗂️</span>
                <span>알림 정리</span>
              </div>
              <p className="text-[13.5px] text-foreground/85 leading-relaxed">
                받은 알림 중에서 흐름을 이해하기 쉽도록 정리해서 보여드려요.
              </p>

              <div className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-5">
                {/* 앞으로 예정된 이벤트 */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
                    <span>📅</span>
                    <span>앞으로 예정된 이벤트</span>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background px-3.5 py-3 flex items-start gap-3">
                    <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md bg-[color:var(--pos-soft)] text-[color:var(--pos)]">
                      D-2
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-bold text-foreground leading-snug">
                        삼성전자 잠정실적
                      </div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">
                        메모리 가격 흐름 주목
                      </div>
                    </div>
                    <CalendarClock className="size-4 text-muted-foreground/60 mt-0.5" />
                  </div>
                </div>

                {/* 이전 변화 */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
                    <span>🕒</span>
                    <span>이전 변화</span>
                  </div>
                  <ol className="relative space-y-2.5 pl-4">
                    <span className="absolute left-1.5 top-2 bottom-2 w-px bg-border" />
                    {visibleTimeline.map((h, i) => {
                      const up = h.impact?.dir === "up";
                      const impactColor = h.impact
                        ? up
                          ? "text-[color:var(--pos)] bg-[color:var(--pos-soft)]"
                          : "text-[color:var(--neg)] bg-[color:var(--neg-soft)]"
                        : "";
                      const Icon = up ? TrendingUp : TrendingDown;
                      return (
                        <li key={i} className="relative">
                          <span className="absolute -left-[11px] top-3 size-2 rounded-full ring-2 ring-background bg-foreground/70" />
                          <div className="rounded-xl border border-border/60 bg-background px-3.5 py-3">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[11.5px] font-semibold text-muted-foreground tabular-nums">
                                {h.date}
                              </span>
                              {h.impact && (
                                <span
                                  className={`inline-flex items-center gap-1 text-[11.5px] font-bold px-2 py-0.5 rounded-md tabular-nums ${impactColor}`}
                                >
                                  <Icon className="size-3" />
                                  {h.impact.value}
                                </span>
                              )}
                            </div>
                            <p className="text-[13px] text-foreground/90 leading-relaxed">
                              {h.text}
                            </p>
                            {h.impact && (
                              <div className="mt-2 pt-2 border-t border-border/50 flex items-start gap-1.5">
                                <span className="text-[10.5px] font-semibold text-muted-foreground shrink-0 mt-px">
                                  영향
                                </span>
                                <span className="text-[12px] text-foreground/75 leading-relaxed">
                                  {h.impact.note}
                                </span>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {TIMELINE.length > PREVIEW_COUNT && (
                    <button
                      onClick={() => setShowAll((v) => !v)}
                      className="w-full flex items-center justify-center gap-1 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground py-2 rounded-lg border border-border/60 bg-background"
                    >
                      {showAll ? "접기" : "기록 더보기"}
                      {showAll ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* 챗봇 입력 CTA */}
          <AiChatCta onClick={goChat} />
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}