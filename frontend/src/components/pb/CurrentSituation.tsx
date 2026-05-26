import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { tagClassName } from "./tag-style";
import { HoldingDetailDialog } from "./HoldingDetailDialog";
import { MarketEventDialog } from "./MarketEventDialog";
import { useHoldingSignals, useMarketEvents, useSchedules } from "@/hooks/useApiData";
function SummaryBlock({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-background px-3.5 py-3 mb-1">
      <div className="flex items-center gap-1 text-[12px] font-semibold text-muted-foreground mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-foreground/85">{children}</p>
    </div>
  );
}

type Holding = {
  tag: string;
  title: string;
  time: string;
  desc: string;
  subDesc: string;
  read?: boolean;
};

type Market = {
  title: string;
  time: string;
  desc: string;
  hashtags: string[];
  relevance: string;
  read?: boolean;
};

type Schedule = {
  dTag: string;
  date: string;
  title: string;
  desc: string;
};

const holdings: Holding[] = [
  {
    tag: "보유",
    title: "삼성전자",
    time: "방금",
    desc: "외국인 투자자들이 많이 사들이고 있어요",
    subDesc: "HBM 수요 확대와 메모리 가격 반등 기대가 매수세를 자극하고 있어요",
  },
  {
    tag: "관심",
    title: "PLUS K 방산",
    time: "7분 전",
    desc: "실시간 종목 8위를 기록했어요",
    subDesc: "정부 방산 수출 지원 확대 발표로 관련 ETF에 자금이 몰리고 있어요",
  },
  {
    tag: "보유",
    title: "KCGI코리아증권투자신탁",
    time: "10분 전",
    desc: "운용성과가 기대만큼 나오지 않았어요",
    subDesc: "반도체 비중이 낮아 코스피 상승 대비 수익률 격차가 벌어졌어요",
  },
];

const markets: Market[] = [
  {
    title: "국제 유가 +2.4%",
    time: "방금",
    desc: "에너지 업종 강세 가능",
    hashtags: ["에너지", "유가"],
    relevance: "내가 보유·관심으로 등록한 자산과 관련이 높아요",
  },
  {
    title: "스타벅스 마케팅 논란 확산",
    time: "20분 전",
    desc: "보이콧 움직임에 신세계·이마트 단기 약세, 경쟁 카페 반사이익",
    hashtags: ["소비", "외식"],
    relevance: "내가 보유한 자산과 관련이 높아요",
  },

  {
    title: "정부 방산 산업 투자 확대 결정",
    time: "2시간 전",
    desc: "국내 방산 기업 전반에 대한 기대감 상승",
    hashtags: ["방산", "정책"],
    relevance: "내가 관심으로 등록한 자산과 관련이 높아요",
  },
];

const schedules: Schedule[] = [
  { dTag: "D-1", date: "05/22(금)", title: "카카오 2분기 실적보고 발표", desc: "광고·커머스 성과와 AI 성장 전략 공개 예정" },
  { dTag: "D-2", date: "05/23(토)", title: "KODEX 200 분배금 예정일", desc: "보유 수량 기준 분배금 입금 예정" },
  { dTag: "D-7", date: "05/28(목)", title: "키움 뉴글로벌 100조 ELS 1888회", desc: "기초자산 종가에 따라 상환 여부 결정" },
];

function CardShell({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-card border border-border/60 px-4 py-3.5 hover:bg-muted/30 transition-colors"
    >
      {children}
    </button>
  );
}

function HoldingCard({ it, onClick }: { it: Holding; onClick?: () => void }) {
  return (
    <CardShell onClick={onClick}>
      <div className="flex items-center gap-2">
        <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 min-w-[34px] text-center ${tagClassName(it.tag)}`}>
          {it.tag}
        </span>
        <span className="flex-1 text-[14.5px] font-bold text-foreground truncate">{it.title}</span>
        <span className="text-[12px] text-foreground/60 shrink-0">{it.time}</span>
      </div>
      <p className="mt-1.5 pl-[42px] text-[13px] text-foreground/85 leading-[1.5]">{it.desc}</p>
      <p className="mt-1 pl-[42px] text-[12.5px] text-muted-foreground leading-[1.5]">{it.subDesc}</p>
    </CardShell>
  );
}

function MarketCard({ it, onClick }: { it: Market; onClick?: () => void }) {
  return (
    <CardShell onClick={onClick}>
      <div className="flex items-start gap-2">
        <span className="flex-1 text-[14.5px] font-bold text-foreground">{it.title}</span>
        <span className="text-[12px] text-foreground/60 shrink-0 mt-0.5">{it.time}</span>
      </div>
      <p className="mt-1 text-[13px] text-foreground/85 leading-[1.5]">{it.desc}</p>
      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
        {it.hashtags.map((h) => (
          <span key={h} className="text-[12px] text-[color:var(--brand)]">#{h}</span>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <span className="text-[12px]">🎯</span>
        <span>{it.relevance}</span>
      </div>
    </CardShell>
  );
}

function ScheduleCard({ it, onClick }: { it: Schedule; onClick?: () => void }) {
  return (
    <CardShell onClick={onClick}>
      <div className="flex items-center gap-2">
        <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 min-w-[34px] text-center ${tagClassName(it.dTag)}`}>
          {it.dTag}
        </span>
        <span className="text-[12px] text-foreground/70">{it.date}</span>
        <span className="flex-1" />
        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
      </div>
      <p className="mt-1.5 text-[14.5px] font-bold text-foreground">{it.title}</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground leading-[1.5]">{it.desc}</p>
    </CardShell>
  );
}

function Section({ emoji, title, subtitle, children }: { emoji: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="px-5">
      <div className="bg-card rounded-2xl border border-border/70 overflow-hidden">
        <div className="bg-[#606CF2] px-4 py-3">
          <div className="flex items-center gap-1.5 text-[14.5px] font-semibold text-white">
            <span className="text-[15px] leading-none">{emoji}</span>
            {title}
          </div>
          <p className="mt-0.5 text-[11.5px] text-white/80 leading-snug">{subtitle}</p>
        </div>
        <div className="space-y-2 px-4 pt-2 pb-3">{children}</div>
      </div>
    </div>
  );
}

export function CurrentSituation() {
  const navigate = useNavigate();
  const { holdings, markets, schedules, loading } = useCurrentSituationData();
  const [activeHolding, setActiveHolding] = useState<"samsung" | "kcgi" | "plusk" | "kakao" | "kodex" | "els" | null>(null);
  const [openOil, setOpenOil] = useState(false);
  const [openDefense, setOpenDefense] = useState(false);
  const [openStarbucks, setOpenStarbucks] = useState(false);
  const marketOpen = openOil || openDefense || openStarbucks;
  const activeVariant: "oil" | "defense" | "starbucks" = openDefense
    ? "defense"
    : openStarbucks
    ? "starbucks"
    : "oil";
  const activeTitle = openDefense
    ? "정부 방산 산업 투자 확대 결정"
    : openStarbucks
    ? "스타벅스 마케팅 논란 확산"
    : "국제 유가 +2.4% 상승";
  const handleMarketOpenChange = (next: boolean) => {
    if (!next) {
      setOpenOil(false);
      setOpenDefense(false);
      setOpenStarbucks(false);
    }
  };
  void navigate;

  const handleHoldingClick = (it: Holding) => {
    if (it.title === "삼성전자") setActiveHolding("samsung");
    else if (it.title === "KCGI코리아증권투자신탁") setActiveHolding("kcgi");
    else if (it.title === "PLUS K 방산") setActiveHolding("plusk");
  };

  const handleMarketClick = (it: Market) => {
    if (it.title === "국제 유가 +2.4%") setOpenOil(true);
    else if (it.title === "정부 방산 산업 투자 확대 결정") setOpenDefense(true);
    else if (it.title === "스타벅스 마케팅 논란 확산") setOpenStarbucks(true);
  };


  const handleScheduleClick = (it: Schedule) => {
    if (it.title === "카카오 2분기 실적보고 발표") setActiveHolding("kakao");
    else if (it.title === "KODEX 200 분배금 예정일") setActiveHolding("kodex");
    else if (it.title === "키움 뉴글로벌 100조 ELS 1888회") setActiveHolding("els");
  };

  return (
    <div className="space-y-4 pb-6">
      <Section emoji="💡" title="내 투자 변동" subtitle="보유·관심 상품의 주요 변동을 한눈에 모아드려요">
        <SummaryBlock icon="✨" label="AI 요약">
          오늘 내가 보유·관심으로 등록한 상품 중 <span className="font-bold text-[color:var(--pos)]">60%</span>에 해당하는 상품에 알림을 받았어요.
        </SummaryBlock>
        {holdings.map((it) => (
          <HoldingCard key={it.title} it={it} onClick={() => handleHoldingClick(it)} />
        ))}
      </Section>
      <Section emoji="🔍" title="지금뜨는 이벤트·시황" subtitle="시장에서 주목받는 이슈와 그 영향을 알려드려요">
        <SummaryBlock icon="✨" label="AI 요약">
          지금 시장은 <span className="font-semibold">금리·환율</span>을 중심으로, 미국 CPI 둔화와 ECB 동결로 인해 기대가 커지며 국채금리가 하락 흐름이에요. 성장주·테크에 우호적인 유동성 환경이 형성되지만, 환율·유가 변동성에 따라 수출주와 에너지 방향성은 엇갈릴 수 있어요.
        </SummaryBlock>
        {markets.map((it) => (
          <MarketCard key={it.title} it={it} onClick={() => handleMarketClick(it)} />
        ))}
      </Section>
      <Section emoji="📅" title="다가오는 일정" subtitle="놓치면 안 될 투자 일정을 챙겨드려요">
        <SummaryBlock icon="✨" label="AI 요약">
          이번주는 <span className="font-bold">3건</span>의 일정이 예정되어 있어요. 내일은 <span className="font-semibold">카카오 2분기 실적</span>이 발표되고, 모레는 <span className="font-semibold">KODEX 200 분배금</span>이 입금돼요. 다음주에는 <span className="font-semibold">키움 뉴글로벌 100조 ELS 1888회</span>의 상환 여부가 결정되니 함께 챙겨두면 좋아요.
        </SummaryBlock>
        {schedules.map((it) => (
          <ScheduleCard key={it.title} it={it} onClick={() => handleScheduleClick(it)} />
        ))}
      </Section>
      {(() => {
        const sharedMasters = [
          { emoji: "🔥", name: "공격형 고수", note: "추가 매수 진행 중", action: "매수" as const },
          { emoji: "💎", name: "장기형 고수", note: "장기 보유 유지", action: "매수" as const },
          { emoji: "🔍", name: "분석형 고수", note: "일부 차익 실현", action: "매도" as const },
        ];
        const sharedPoll = {
          buyCount: 2,
          sellCount: 1,
          pollLabel: "매수 우위",
          aiPbSummary: "투자고수 3팀 중 2팀이 매수, 1팀이 매도로 단기 매수 흐름이 우세해요.",
          masters: sharedMasters,
        };
        const props =
          activeHolding === "samsung"
            ? { ...sharedPoll }
            : activeHolding === "plusk"
            ? {
                tag: "관심",
                title: "PLUS K 방산",
                summary: "실시간 종목 8위를 기록했어요.",
                summarySub: "한 시간 만에 실시간 종목 순위가 120위에서 8위까지 빠르게 올라왔어요.",
                reasons: [
                  "정부가 방산 산업에 대한 투자와 수출 지원 확대를 발표하면서, 관련 기업들의 수주 확대 기대가 반영되고 있어요.",
                  "특히 방산 장비와 항공·우주 분야에서 경쟁력이 있는 기업 중심으로 실적 개선 기대가 커지고 있어요.",
                ],
                buyCount: 3,
                sellCount: 0,
                pollLabel: "전원 매수",
                aiPbSummary: "투자고수 3팀이 모두 매수로 단기 매수 흐름이 압도적으로 우세해요.",
                masters: [
                  { emoji: "🔥", name: "공격형 고수", note: "추가 매수 진행 중", action: "매수" as const },
                  { emoji: "📈", name: "장기형 고수", note: "비중 확대", action: "매수" as const },
                  { emoji: "🔍", name: "분석형 고수", note: "신규 진입", action: "매수" as const },
                ],
              }
            : activeHolding === "kcgi"
            ? {
                tag: "보유",
                title: "KCGI코리아증권투자신탁",
                summary: "운용성과가 기대만큼 나오지 않았어요.",
                summarySub: "코스피 대비 수익률이 한 달간 약 -5.5% 낮은 상태예요.",
                chart: {
                  title: "코스피 대비 수익률 (최근 1개월)",
                  gap: "-5.5%p",
                  data: [
                    { label: "4주 전", kospi: 2.5, fund: -3 },
                    { label: "3주 전", kospi: 3.5, fund: -3.5 },
                    { label: "2주 전", kospi: 3, fund: -4 },
                    { label: "1주 전", kospi: 4, fund: -3.2 },
                    { label: "오늘", kospi: 3, fund: -3 },
                  ],
                  fundLabel: "KCGI코리아증권투자신탁",
                  caption: "최근 한 달간 코스피는 상승 흐름을 이어간 반면, KCGI코리아증권투자신탁은 하락하며 약 -5.5%p 수익률 격차가 벌어졌어요.",
                },
                reasons: [
                  "반도체 중심 상승으로 코스피가 빠르게 올랐어요.",
                  "해당 펀드는 반도체 비중이 낮아 수익률 격차가 벌어졌어요.",
                ],
                sources: ["한국경제", "연합뉴스", "금융감독원 전자공시"],
                buyCount: 0,
                sellCount: 1,
                pollLabel: "매도 우위",
                aiPbSummary: "금융상품 고수 1팀이 환매에 무게를 두며 단기 매도 흐름이 우세해요.",
                masters: [
                  { emoji: "💎", name: "금융상품 고수", note: "일부 환매", action: "매도" as const },
                ],
              }
            : activeHolding === "kakao"
            ? {
                tag: "D-1",
                title: "카카오 2분기 실적보고 발표",
                summaryIcon: "🤖",
                summaryLabel: "AI 이벤트 요약",
                summary: "카카오 2분기 실적 발표가 내일 예정되어 있어요.",
                summarySub: "실적 결과와 향후 성장 전략에 따라 단기적으로 주가 변동성이 확대될 수 있는 이벤트예요.",
                reasonsIcon: "📣",
                reasonsLabel: "무슨 일이 일어날까?",
                reasons: [
                  "카카오는 이번 실적 발표를 통해 광고·커머스·콘텐츠 등 주요 사업 성과와 AI 기반 성장 전략을 함께 공개할 예정이에요.",
                  "실적 수준이나 향후 전망에 따라 주가는 상승하거나 하락하는 등 변동성이 확대될 수 있어요.",
                ],
                sources: ["한국경제", "연합뉴스", "금융감독원 전자공시"],
                hideMasters: true,
                history: [
                  {
                    date: "2026.05",
                    change: "-3~5%",
                    direction: "down" as const,
                    text: "역대 1분기 최대 실적을 기록했지만 기대 대비 부족과 AI 수익화 불확실성 영향으로 발표 이후 주가가 약 -3~5% 하락하는 등 부진한 흐름을 보였어요.",
                  },
                  {
                    date: "2026.02",
                    change: "-4%",
                    direction: "down" as const,
                    text: "실적이 시장 기대치를 일부 하회하며 발표 이후 주가가 약 -4% 하락했어요.",
                  },
                  {
                    date: "2025.11",
                    change: "+3%",
                    direction: "up" as const,
                    text: "매출 증가 및 실적 개선에 따라 발표 이후 주가가 약 +3% 내외 상승했어요.",
                  },
                ],
              }
            : activeHolding === "kodex"
            ? {
                tag: "D-2",
                title: "KODEX 200 분배금 예정일",
                summaryIcon: "🤖",
                summaryLabel: "AI 이벤트 요약",
                summary: "분배금을 받을 예정이에요.",
                summarySub: "보유 수량 기준으로 분배금이 지급되며, 분배락일에는 분배금만큼 기준가격이 조정될 수 있어요.",
                reasonsIcon: "💰",
                reasonsLabel: "무슨 일이 일어날까?",
                reasons: [
                  "KODEX 200의 분배금 지급 기준일이 도래하면서, 보유 수량에 따라 분배금이 지급될 예정이에요.",
                  "분배락일에는 분배금 상당액만큼 ETF 기준가격이 조정될 수 있어요.",
                ],
                sources: ["삼성자산운용 공시", "한국거래소"],
                hideMasters: true,
                history: [
                  { date: "2025.04", change: "주당 320원", direction: "up" as const, text: "2025년 4월 분배 기준일에 주당 약 320원이 지급되었어요." },
                  { date: "2024.10", change: "주당 280원", direction: "up" as const, text: "2024년 10월 분배 기준일에 주당 약 280원이 지급되었어요." },
                  { date: "2024.04", change: "주당 250원", direction: "up" as const, text: "2024년 4월 분배 기준일에 주당 약 250원이 지급되었어요." },
                ],
              }
            : activeHolding === "els"
            ? {
                tag: "D-7",
                title: "키움 뉴글로벌 100조 ELS 1888회",
                summaryIcon: "🤖",
                summaryLabel: "AI 이벤트 요약",
                summary: "테슬라·엔비디아 기초자산 ELS의 만기일이 다가오고 있어요.",
                summarySub: "만기 평가일 종가가 상환 조건을 충족하면 원금과 약정 수익이 함께 지급돼요.",
                reasonsIcon: "📣",
                reasonsLabel: "무슨 일이 일어날까?",
                reasons: [
                  "만기 평가일에 두 기초자산 모두 최초 기준가격의 일정 비율(예: 65~70%) 이상이면 약정 수익과 함께 원금이 상환돼요.",
                  "조건을 충족하지 못하면 손실 구간에 해당되어 원금 손실이 발생할 수 있어요.",
                  "발표 직전 두 종목의 변동성에 따라 상환 여부가 결정되므로 주가 흐름을 함께 살펴보는 것이 좋아요.",
                ],
                sources: ["한국예탁결제원", "발행 증권사 공시"],
                hideMasters: true,
              }
            : {};
        return (
          <HoldingDetailDialog
            key={activeHolding ?? "none"}
            open={activeHolding !== null}
            onOpenChange={(o) => { if (!o) setActiveHolding(null); }}
            {...props}
          />
        );
      })()}
      <MarketEventDialog
        key={activeVariant}
        open={marketOpen}
        onOpenChange={handleMarketOpenChange}
        title={activeTitle}
        variant={activeVariant}
      />
    </div>
  );
}
