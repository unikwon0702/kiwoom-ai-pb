import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer";
import { Drawer as DrawerPrimitive } from "vaul";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useNavigate } from "@tanstack/react-router";
import { X, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { AiChatCta } from "./AiChatCta";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

type Master = {
  emoji: string;
  name: string;
  short: string;
  traits: string[];
  accent: string;
};

const masters: Master[] = [
  {
    emoji: "🔥",
    name: "공격형 고수",
    short: "단기 고수익·빠른 의사결정",
    traits: ["단타 위주", "테마주 선호", "빠른 손절·익절"],
    accent: "var(--neg)",
  },
  {
    emoji: "🌳",
    name: "장기형 고수",
    short: "기업 가치 중심, 안정적 수익",
    traits: ["우량주 보유", "분기 단위 매매", "배당 선호"],
    accent: "var(--info)",
  },
  {
    emoji: "🔍",
    name: "분석형 고수",
    short: "체계적 분석·객관적 판단",
    traits: ["재무제표 분석", "데이터 기반", "리스크 관리"],
    accent: "var(--brand-sub)",
  },
  {
    emoji: "🏦",
    name: "금융상품 고수",
    short: "투자 안정성·자산 다변화",
    traits: ["ETF·펀드 선호", "포트폴리오 분산", "리밸런싱"],
    accent: "var(--brand)",
  },
];

type Pick = { ticker: string; sector: string; weight: number };
type DailyPick = {
  master: Master;
  date: string;
  buys: Pick[];
  sells: Pick[];
};

const dailyPicks: DailyPick[] = [
  {
    master: masters[0],
    date: "어제 5월 20일 기준",
    buys: [
      { ticker: "삼성전자", sector: "반도체", weight: 38 },
      { ticker: "KODEX 레버리지", sector: "ETF", weight: 22 },
      { ticker: "SK하이닉스", sector: "반도체", weight: 18 },
      { ticker: "현대차", sector: "자동차", weight: 12 },
      { ticker: "LG", sector: "기타", weight: 10 },
    ],
    sells: [
      { ticker: "KODEX 인버스", sector: "ETF", weight: 60 },
      { ticker: "한미반도체", sector: "반도체", weight: 40 },
      { ticker: "카카오뱅크", sector: "금융", weight: 25 },
      { ticker: "두산에너빌리티", sector: "에너지", weight: 15 },
    ],
  },
  {
    master: masters[1],
    date: "어제 5월 20일 기준",
    buys: [
      { ticker: "삼성전자", sector: "반도체", weight: 30 },
      { ticker: "현대차", sector: "자동차", weight: 22 },
      { ticker: "KB금융", sector: "금융", weight: 18 },
      { ticker: "셀트리온", sector: "바이오", weight: 16 },
      { ticker: "POSCO", sector: "철강", weight: 14 },
    ],
    sells: [
      { ticker: "카카오", sector: "IT", weight: 55 },
      { ticker: "엔씨소프트", sector: "게임", weight: 45 },
      { ticker: "한국전력", sector: "에너지", weight: 30 },
      { ticker: "삼성물산", sector: "건설", weight: 20 },
      { ticker: "CJ대한통운", sector: "물류", weight: 15 },
    ],
  },
  {
    master: masters[2],
    date: "어제 5월 20일 기준",
    buys: [
      { ticker: "SK하이닉스", sector: "반도체", weight: 32 },
      { ticker: "NAVER", sector: "IT", weight: 24 },
      { ticker: "기아", sector: "자동차", weight: 18 },
      { ticker: "한화에어로스페이스", sector: "방산", weight: 14 },
      { ticker: "두산에너빌리티", sector: "에너지", weight: 12 },
    ],
    sells: [
      { ticker: "LG디스플레이", sector: "IT", weight: 50 },
      { ticker: "삼성SDI", sector: "2차전지", weight: 50 },
      { ticker: "현대모비스", sector: "자동차", weight: 35 },
      { ticker: "LG화학", sector: "화학", weight: 25 },
      { ticker: "대한항공", sector: "항공", weight: 20 },
      { ticker: "넷마블", sector: "게임", weight: 15 },
    ],
  },
  {
    master: masters[3],
    date: "어제 5월 20일 기준",
    buys: [
      { ticker: "TIGER 미국S&P500", sector: "ETF", weight: 30 },
      { ticker: "KODEX 200", sector: "ETF", weight: 25 },
      { ticker: "KODEX 단기채권", sector: "채권", weight: 20 },
      { ticker: "TIGER 미국나스닥100", sector: "ETF", weight: 15 },
      { ticker: "KOSEF 국고채10년", sector: "채권", weight: 10 },
    ],
    sells: [
      { ticker: "KODEX 코스닥150", sector: "ETF", weight: 100 },
      { ticker: "TIGER 중국CSI300", sector: "ETF", weight: 45 },
      { ticker: "KOSEF 미국달러", sector: "ETF", weight: 30 },
    ],
  },
];

type Portfolio = {
  master: Master;
  totalKRW: string;
  avgHoldings: string;
  turnover: string;
  domesticRatio: number;
  sectorAllocation: { label: string; value: number; color: string }[];
  domesticTop: { label: string; value: number }[];
  overseasTop: { label: string; value: number }[];
};

const portfolios: Portfolio[] = [
  {
    master: masters[0],
    totalKRW: "9억원",
    avgHoldings: "9.7개",
    turnover: "2배",
    domesticRatio: 55,
    sectorAllocation: [
      { label: "IT", value: 24.5, color: "#3B5BFF" },
      { label: "ETF", value: 21.9, color: "#E22D72" },
      { label: "중공업", value: 21.3, color: "#6BB6FF" },
      { label: "금융", value: 4.1, color: "#A0A0A0" },
      { label: "기타", value: 28.2, color: "#222222" },
    ],
    domesticTop: [
      { label: "삼성전자", value: 27.4 },
      { label: "KODEX 코스피", value: 17.4 },
      { label: "현대차", value: 17.4 },
      { label: "NAVER", value: 12.0 },
      { label: "KODEX200", value: 9.7 },
      { label: "기타", value: 19.1 },
    ],
    overseasTop: [
      { label: "NVDA", value: 26.7 },
      { label: "AAPL", value: 24.7 },
      { label: "MSFT", value: 19.3 },
      { label: "QQQ", value: 7.6 },
      { label: "TSLA", value: 5.9 },
      { label: "기타", value: 15.8 },
    ],
  },
  {
    master: masters[1],
    totalKRW: "15억원",
    avgHoldings: "12.4개",
    turnover: "0.4배",
    domesticRatio: 68,
    sectorAllocation: [
      { label: "반도체", value: 28.0, color: "#3B5BFF" },
      { label: "금융", value: 22.0, color: "#E22D72" },
      { label: "자동차", value: 18.0, color: "#6BB6FF" },
      { label: "바이오", value: 12.0, color: "#A0A0A0" },
      { label: "기타", value: 20.0, color: "#222222" },
    ],
    domesticTop: [
      { label: "삼성전자", value: 22.5 },
      { label: "KB금융", value: 16.8 },
      { label: "현대차", value: 14.2 },
      { label: "셀트리온", value: 11.0 },
      { label: "POSCO", value: 9.5 },
      { label: "기타", value: 26.0 },
    ],
    overseasTop: [
      { label: "BRK.B", value: 22.0 },
      { label: "JNJ", value: 18.5 },
      { label: "KO", value: 14.0 },
      { label: "PG", value: 12.0 },
      { label: "VTI", value: 10.5 },
      { label: "기타", value: 23.0 },
    ],
  },
  {
    master: masters[2],
    totalKRW: "12억원",
    avgHoldings: "15.2개",
    turnover: "1.1배",
    domesticRatio: 60,
    sectorAllocation: [
      { label: "반도체", value: 26.0, color: "#3B5BFF" },
      { label: "IT", value: 20.0, color: "#E22D72" },
      { label: "방산", value: 16.0, color: "#6BB6FF" },
      { label: "자동차", value: 14.0, color: "#A0A0A0" },
      { label: "기타", value: 24.0, color: "#222222" },
    ],
    domesticTop: [
      { label: "SK하이닉스", value: 21.0 },
      { label: "NAVER", value: 17.5 },
      { label: "기아", value: 13.2 },
      { label: "한화에어로", value: 11.8 },
      { label: "두산에너", value: 10.5 },
      { label: "기타", value: 26.0 },
    ],
    overseasTop: [
      { label: "GOOGL", value: 23.0 },
      { label: "META", value: 19.5 },
      { label: "AMD", value: 15.0 },
      { label: "TSM", value: 13.0 },
      { label: "QQQ", value: 10.0 },
      { label: "기타", value: 19.5 },
    ],
  },
  {
    master: masters[3],
    totalKRW: "20억원",
    avgHoldings: "18.6개",
    turnover: "0.3배",
    domesticRatio: 45,
    sectorAllocation: [
      { label: "ETF", value: 42.0, color: "#3B5BFF" },
      { label: "채권", value: 28.0, color: "#E22D72" },
      { label: "금융", value: 12.0, color: "#6BB6FF" },
      { label: "IT", value: 8.0, color: "#A0A0A0" },
      { label: "기타", value: 10.0, color: "#222222" },
    ],
    domesticTop: [
      { label: "KODEX 200", value: 24.0 },
      { label: "KODEX 단기채", value: 20.5 },
      { label: "KOSEF 국고채", value: 14.0 },
      { label: "TIGER 코스피", value: 11.0 },
      { label: "ARIRANG 고배당", value: 9.5 },
      { label: "기타", value: 21.0 },
    ],
    overseasTop: [
      { label: "VOO", value: 26.0 },
      { label: "QQQ", value: 22.0 },
      { label: "BND", value: 16.0 },
      { label: "VEA", value: 12.0 },
      { label: "VWO", value: 10.0 },
      { label: "기타", value: 14.0 },
    ],
  },
];

function Carousel<T>({
  items,
  renderItem,
}: {
  items: T[];
  renderItem: (item: T, idx: number) => React.ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      setActiveIdx(idx);
    };
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
        <div
          ref={scrollerRef}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-6 px-6 gap-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, i) => (
            <div key={i} className="snap-center shrink-0 w-full">
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2.5">
        <button
          onClick={() => scrollTo(Math.max(0, activeIdx - 1))}
          disabled={activeIdx === 0}
          aria-label="이전"
          className="size-6 rounded-full flex items-center justify-center text-muted-foreground disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex items-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              aria-label={`${i + 1}번째`}
              className={`size-1.5 rounded-full transition-all ${
                i === activeIdx ? "bg-foreground w-4" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => scrollTo(Math.min(items.length - 1, activeIdx + 1))}
          disabled={activeIdx === items.length - 1}
          aria-label="다음"
          className="size-6 rounded-full flex items-center justify-center text-muted-foreground disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
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
  const buyNotes = [
    "거래량 급증, 단기 모멘텀 강화",
    "외국인 순매수 유입세 지속",
    "실적 기대감, 업종 내 상대강도 상승",
    "기관 매집 흔적, 추세 전환 신호",
    "배당·실적 안정성 부각",
  ];
  const sellNotes = [
    "단기 과열, 차익실현 압력",
    "수급 약화, 추세 둔화 감지",
    "실적 모멘텀 둔화, 비중 축소",
    "기술적 저항선 부담",
    "리스크 헤지 차원 정리",
  ];
  const notes = tone === "buy" ? buyNotes : sellNotes;
  return { price, pct, note: notes[h % notes.length] };
}

function BubbleMap({ picks, tone }: { picks: Pick[]; tone: "buy" | "sell" }) {
  const isBuy = tone === "buy";
  const baseColor = isBuy ? "var(--pos)" : "var(--neg)";
  const softColor = isBuy ? "var(--pos-soft)" : "var(--neg-soft)";

  return (
    <div className="relative h-[200px] rounded-2xl bg-muted/30 overflow-hidden">
      {picks.map((p, i) => {
        const size = 42 + (p.weight / 100) * 70;
        const positions = [
          { left: "50%", top: "50%" },
          { left: "32%", top: "32%" },
          { left: "68%", top: "34%" },
          { left: "34%", top: "70%" },
          { left: "68%", top: "70%" },
          { left: "50%", top: "20%" },
        ];
        const pos = positions[i] ?? { left: "50%", top: "50%" };
        const q = mockQuote(p.ticker, p.weight, tone);
        return (
          <Popover key={i}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center text-center px-1.5 font-bold border-2 cursor-pointer transition-transform active:scale-95 hover:scale-105"
                style={{
                  left: pos.left,
                  top: pos.top,
                  width: size,
                  height: size,
                  backgroundColor: `color-mix(in oklab, ${baseColor} ${Math.min(p.weight * 1.4, 90)}%, white)`,
                  borderColor: baseColor,
                  color: p.weight > 30 ? "white" : `color-mix(in oklab, ${baseColor} 70%, black)`,
                  fontSize: Math.max(8.5, Math.min(11, size / 9)),
                  lineHeight: 1.1,
                }}
              >
                <span className="line-clamp-2 break-keep">{p.ticker}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="center" className="w-60 p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-foreground truncate">{p.ticker}</span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: softColor, color: baseColor }}
                  >
                    {isBuy ? "매수" : "매도"}
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[10.5px] text-muted-foreground">현재가</div>
                    <div className="text-[14px] font-bold text-foreground">
                      {q.price.toLocaleString()}원
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10.5px] text-muted-foreground">수익률</div>
                    <div
                      className="text-[14px] font-bold"
                      style={{ color: q.pct >= 0 ? "var(--pos)" : "var(--neg)" }}
                    >
                      {q.pct >= 0 ? "+" : ""}
                      {q.pct}%
                    </div>
                  </div>
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
      <div
        className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none"
        style={{ backgroundColor: softColor, color: baseColor }}
      >
        {isBuy ? "매수" : "매도"}
      </div>
    </div>
  );
}

function donutReason(label: string, value: number, side: "국내" | "해외") {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  const up = (h & 1) === 0;
  const pct = +((value / 4 + (h % 30) / 10 + 0.5) * (up ? 1 : -1)).toFixed(2);
  const upReasons = [
    "실적 서프라이즈로 투자심리 개선",
    "외국인·기관 동반 순매수 유입",
    "업종 전반 강세, 상대강도 상승",
    "신제품·수주 모멘텀 부각",
    "환율·금리 환경 우호적",
  ];
  const downReasons = [
    "단기 차익실현 매물 출회",
    "업황 둔화 우려로 매도 우위",
    "환율 변동성 확대, 수급 약화",
    "실적 가이던스 하향 조정",
    "거시 불확실성에 따른 리스크오프",
  ];
  const reasons = up ? upReasons : downReasons;
  return {
    pct,
    reason: reasons[h % reasons.length],
    sideNote: side === "국내" ? "국내 비중 종목" : "해외 비중 종목",
  };
}

function MiniDonut({
  data,
  side,
}: {
  data: { label: string; value: number }[];
  side: "국내" | "해외";
}) {
  const colors = ["#3B5BFF", "#6BB6FF", "#9BC8FF", "#C5DCFF", "#E0E9FF", "#D4D4D4"];
  const [selected, setSelected] = useState<number | null>(null);
  const sel = selected != null ? data[selected] : null;
  const info = sel ? donutReason(sel.label, sel.value, side) : null;

  return (
    <Popover open={selected != null} onOpenChange={(o) => !o && setSelected(null)}>
      <PopoverTrigger asChild>
        <div className="h-[120px] w-full cursor-pointer">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius="55%"
                outerRadius="95%"
                paddingAngle={1}
                stroke="none"
                onClick={(_, idx) => setSelected(idx)}
              >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={colors[i % colors.length]}
                    style={{ cursor: "pointer", outline: "none" }}
                    opacity={selected != null && selected !== i ? 0.45 : 1}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </PopoverTrigger>
      {sel && info && (
        <PopoverContent side="top" align="center" className="w-60 p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold text-foreground truncate">{sel.label}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {info.sideNote}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10.5px] text-muted-foreground">비중</div>
                <div className="text-[14px] font-bold text-foreground">{sel.value}%</div>
              </div>
              <div className="text-right">
                <div className="text-[10.5px] text-muted-foreground">최근 수익률</div>
                <div
                  className="text-[14px] font-bold"
                  style={{ color: info.pct >= 0 ? "var(--pos)" : "var(--neg)" }}
                >
                  {info.pct >= 0 ? "+" : ""}
                  {info.pct}%
                </div>
              </div>
            </div>
            <div className="flex items-start gap-1.5 rounded-lg bg-muted/60 p-2">
              <Sparkles className="size-3 mt-0.5 shrink-0 text-[color:var(--brand)]" />
              <p className="text-[11.5px] leading-snug text-foreground">
                {info.pct >= 0 ? "상승 요인: " : "하락 요인: "}
                {info.reason}
              </p>
            </div>
          </div>
        </PopoverContent>
      )}
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
          <span
            className="size-8 shrink-0 rounded-full flex items-center justify-center text-[14px]"
            style={{
              backgroundColor: `color-mix(in oklab, ${d.master.accent} 14%, white)`,
            }}
          >
            {d.master.emoji}
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold text-foreground leading-tight truncate">
              {d.master.name}의 데일리 픽
            </div>
            <div className="text-[10.5px] text-muted-foreground">{d.date}</div>
          </div>
        </div>

        <div className="relative flex shrink-0 rounded-full bg-muted p-0.5 text-[11px] font-bold">
          <div
            className="absolute top-0.5 bottom-0.5 w-1/2 rounded-full bg-background shadow-sm transition-transform"
            style={{
              transform: isBuy ? "translateX(0%)" : "translateX(100%)",
            }}
          />
          <button
            onClick={() => setMode("buy")}
            className="relative z-10 px-3 py-1 flex items-center gap-1"
            style={{ color: isBuy ? "var(--pos)" : "hsl(var(--muted-foreground))" }}
          >
            <TrendingUp className="size-3" />
            매수
          </button>
          <button
            onClick={() => setMode("sell")}
            className="relative z-10 px-3 py-1 flex items-center gap-1"
            style={{ color: !isBuy ? "var(--neg)" : "hsl(var(--muted-foreground))" }}
          >
            <TrendingDown className="size-3" />
            매도
          </button>
        </div>
      </div>

      <BubbleMap picks={isBuy ? d.buys : d.sells} tone={mode} />
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};


export function MasterInsightDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const goChat = () => {
    onOpenChange(false);
    navigate({ to: "/chat" });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[24px] border bg-background max-w-[480px] mx-auto focus:outline-none">
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 rounded-full bg-muted" />
          <DrawerPrimitive.Title className="sr-only">투자고수 인사이트</DrawerPrimitive.Title>

          <div className="px-6 pt-4 pb-3 space-y-7 max-h-[78vh] overflow-y-auto">
            {/* 헤더 */}
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[18px] font-bold tracking-tight text-foreground leading-snug">
                고수들은 최근에<br />이렇게 움직이고 있어요
              </h2>
              <button
                onClick={() => onOpenChange(false)}
                aria-label="닫기"
                className="size-8 -mr-1 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60"
              >
                <X className="size-4" />
              </button>
            </div>


            {/* 1) 고수들의 특징 */}
            <section className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-[17px] font-extrabold tracking-tight text-foreground">
                  고수들의 특징
                </h3>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                  투자고수는 스타일에 따라 4가지 유형으로 나뉘어요
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {masters.map((m) => (
                  <div
                    key={m.name}
                    className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-9 rounded-full flex items-center justify-center text-[16px]"
                        style={{
                          backgroundColor: `color-mix(in oklab, ${m.accent} 14%, white)`,
                        }}
                      >
                        {m.emoji}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-foreground leading-tight">
                          {m.name}
                        </div>
                      </div>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground leading-snug">
                      {m.short}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {m.traits.map((t) => (
                        <span
                          key={t}
                          className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-foreground/70"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 2) 데일리 픽 */}
            <section className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-[17px] font-extrabold tracking-tight text-foreground">
                  투자고수의 데일리 픽
                </h3>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                  각 고수가 어제 가장 많이 거래한 종목이에요
                </p>
              </div>


              <Carousel
                items={dailyPicks}
                renderItem={(d) => <DailyPickCard pick={d} />}
              />
            </section>


            {/* 3) 포트폴리오 분석 */}
            <section className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-[17px] font-extrabold tracking-tight text-foreground">
                  투자고수의 포트폴리오 분석
                </h3>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                  각 고수가 어떤 자산을 보유하고 있는지 살펴보세요
                </p>
              </div>


              <Carousel
                items={portfolios}
                renderItem={(p) => (
                  <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-8 rounded-full flex items-center justify-center text-[14px]"
                        style={{
                          backgroundColor: `color-mix(in oklab, ${p.master.accent} 14%, white)`,
                        }}
                      >
                        {p.master.emoji}
                      </span>
                      <div>
                        <div className="text-[13.5px] font-bold text-foreground leading-tight">
                          {p.master.name}의 포트폴리오
                        </div>
                        <div className="text-[10.5px] text-muted-foreground">
                          보유 상품 분석
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "주식 평가금액", value: p.totalKRW },
                        { label: "평균 보유종목수", value: p.avgHoldings },
                        { label: "회전율", value: p.turnover },
                      ].map((s) => (
                        <div
                          key={s.label}
                          className="rounded-xl bg-muted/40 px-2 py-2 text-center"
                        >
                          <div className="text-[10px] text-muted-foreground">
                            {s.label}
                          </div>
                          <div className="text-[14px] font-extrabold text-foreground mt-0.5">
                            {s.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 국내/해외 비중 바 */}
                    <div className="space-y-1.5">
                      <div className="flex h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#3B5BFF]"
                          style={{ width: `${p.domesticRatio}%` }}
                        />
                        <div
                          className="bg-[#E22D72]"
                          style={{ width: `${100 - p.domesticRatio}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-[#3B5BFF]">국내 {p.domesticRatio}%</span>
                        <span className="text-[#E22D72]">해외 {100 - p.domesticRatio}%</span>
                      </div>
                    </div>

                    {/* 섹터 비중 */}
                    <div className="space-y-1.5">
                      <div className="flex h-2 rounded-full overflow-hidden">
                        {p.sectorAllocation.map((s, i) => (
                          <div
                            key={i}
                            style={{ width: `${s.value}%`, backgroundColor: s.color }}
                          />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[10.5px]">
                        {p.sectorAllocation.map((s) => (
                          <div key={s.label} className="flex items-center gap-1">
                            <span
                              className="size-1.5 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="text-foreground/80 font-medium">
                              {s.label} {s.value}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 국내/해외 도넛 */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {[
                        { title: "국내", data: p.domesticTop, accent: "#3B5BFF" },
                        { title: "해외", data: p.overseasTop, accent: "#E22D72" },
                      ].map((side) => (
                        <div
                          key={side.title}
                          className="rounded-xl bg-muted/30 p-2.5 space-y-1.5"
                        >
                          <div
                            className="text-[11px] font-bold"
                            style={{ color: side.accent }}
                          >
                            {side.title}
                          </div>
                          <MiniDonut data={side.data} side={side.title as "국내" | "해외"} />
                          <div className="space-y-0.5">
                            {side.data.slice(0, 5).map((d) => (
                              <div
                                key={d.label}
                                className="flex items-center justify-between text-[10px]"
                              >
                                <span className="text-foreground/80 truncate pr-1">
                                  {d.label}
                                </span>
                                <span className="font-semibold text-foreground tabular-nums">
                                  {d.value}%
                                </span>
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
          </div>

          <AiChatCta onClick={goChat} />
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
