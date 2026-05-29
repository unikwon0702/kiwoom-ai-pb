import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { tagClassName } from "./tag-style";
import { HoldingDetailDialog } from "./HoldingDetailDialog";
import { MarketEventDetailDialog } from "./MarketEventDetailDialog";
import { useHoldingSignals, useMarketEvents, useSchedules, useSituationSummary } from "@/hooks/useApiData";
import { useCustomer } from "@/lib/customer-context";
import { api } from "@/lib/api";
import { getDisplayTime } from "@/lib/date";
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
  eventId: string;
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

function useCurrentSituationData(customerId: string): { holdings: Holding[]; markets: Market[]; schedules: Schedule[]; loading: boolean } {
  const { data: holdingsData, loading: hLoading } = useHoldingSignals(customerId, 5);
  const { data: marketsData, loading: mLoading } = useMarketEvents(3);
  const { data: schedulesData, loading: sLoading } = useSchedules(3);

  const holdings: Holding[] = (holdingsData?.holdings ?? []).map((h: any, i: number) => ({
    tag: h.holding_type ?? (h.signal_category === '관심' ? '관심' : '보유'),
    title: h.asset_name ?? '',
    time: getDisplayTime(h.date, i),
    desc: h.signal_name ?? '',
    subDesc: h.interpretation ?? '',
  }));

  const markets: Market[] = (marketsData?.events ?? []).map((e: any, i: number) => ({
    eventId: e.event_id ?? '',
    title: e.event_title ?? '',
    time: getDisplayTime(e.published_at, i + 5),
    desc: e.ai_investment_view ?? e.related_sector ?? '',
    hashtags: [e.related_sector, e.event_type].filter(Boolean) as string[],
    relevance: '내가 보유·관심으로 등록한 자산과 관련이 높아요',
  }));

  const schedules: Schedule[] = (schedulesData?.schedules ?? []).map((s: any, i: number) => ({
    dTag: `D-${i + 1}`,
    date: s.published_at ? new Date(s.published_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' }) : '',
    title: s.event_title ?? '',
    desc: s.event_summary ?? s.event_subtype ?? '',
  }));

  return { holdings, markets, schedules, loading: hLoading || mLoading || sLoading };
}

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
  const { customer } = useCustomer();
  const { holdings, markets, schedules, loading } = useCurrentSituationData(customer.id);
  const { data: situationData } = useSituationSummary(customer.id);
  const [activeHolding, setActiveHolding] = useState<{ type: 'holding' | 'schedule'; key: string } | null>(null);
  const [holdingDetailProps, setHoldingDetailProps] = useState<any>(null);
  const [holdingDetailLoading, setHoldingDetailLoading] = useState(false);

  const [prefetchCache, setPrefetchCache] = useState<Record<string, any>>({});

  // 프리페치: holdings 목록이 로드되면 모든 종목 상세를 백그라운드로 가져옴
  useEffect(() => {
    if (!holdings.length) return;
    holdings.forEach((h) => {
      if (prefetchCache[h.title]) return; // 이미 캐시됨
      api.getHoldingDetail(customer.id, h.title)
        .then((data) => setPrefetchCache((prev) => ({ ...prev, [h.title]: data })))
        .catch(() => {});
    });
  }, [holdings, customer.id]);

  // 클릭 시: 캐시에서 즉시 반환, 없으면 API 호출
  useEffect(() => {
    if (!activeHolding || activeHolding.type !== 'holding') {
      setHoldingDetailProps(null);
      return;
    }
    const cached = prefetchCache[activeHolding.key];
    if (cached) {
      setHoldingDetailProps(cached);
      return;
    }
    setHoldingDetailLoading(true);
    api.getHoldingDetail(customer.id, activeHolding.key)
      .then((data) => {
        setHoldingDetailProps(data);
        setPrefetchCache((prev) => ({ ...prev, [activeHolding.key]: data }));
      })
      .catch(() => setHoldingDetailProps(null))
      .finally(() => setHoldingDetailLoading(false));
  }, [activeHolding, customer.id, prefetchCache]);
  const [activeMarketEventId, setActiveMarketEventId] = useState<string | null>(null);
  void navigate;

  const handleHoldingClick = (it: Holding) => {
    setActiveHolding({ type: 'holding', key: it.title });
  };

  const handleMarketClick = (it: Market) => {
    setActiveMarketEventId(it.eventId);
  };


  const handleScheduleClick = (it: Schedule) => {
    if (it.title === "카카오 2분기 실적보고 발표") setActiveHolding({ type: 'schedule', key: 'kakao' });
    else if (it.title === "KODEX 200 분배금 예정일") setActiveHolding({ type: 'schedule', key: 'kodex' });
    else if (it.title === "키움 뉴글로벌 100조 ELS 1888회") setActiveHolding({ type: 'schedule', key: 'els' });
  };

  return (
    <div className="space-y-4 pb-6">
      <Section emoji="💡" title="내 투자 변동" subtitle="보유·관심 상품의 주요 변동을 한눈에 모아드려요">
        <SummaryBlock icon="✨" label="AI 요약">
          {situationData?.investment_change?.summary || '요약을 불러오는 중이에요...'}
        </SummaryBlock>
        {holdings.map((it) => (
          <HoldingCard key={it.title} it={it} onClick={() => handleHoldingClick(it)} />
        ))}
      </Section>
      <Section emoji="🔍" title="지금뜨는 이벤트·시황" subtitle="시장에서 주목받는 이슈와 그 영향을 알려드려요">
        <SummaryBlock icon="✨" label="AI 요약">
          {situationData?.market_context?.summary || '요약을 불러오는 중이에요...'}
        </SummaryBlock>
        {markets.map((it) => (
          <MarketCard key={it.title} it={it} onClick={() => handleMarketClick(it)} />
        ))}
      </Section>
      <Section emoji="📅" title="다가오는 일정" subtitle="놓치면 안 될 투자 일정을 챙겨드려요">
        <SummaryBlock icon="✨" label="AI 요약">
          {situationData?.upcoming_schedule?.summary || '요약을 불러오는 중이에요...'}
        </SummaryBlock>
        {schedules.map((it) => (
          <ScheduleCard key={it.title} it={it} onClick={() => handleScheduleClick(it)} />
        ))}
      </Section>
            {(() => {
        const scheduleProps: Record<string, any> = {
          kakao: {
            tag: "D-1", title: "카카오 2분기 실적보고 발표",
            summaryIcon: "🤖", summaryLabel: "AI 이벤트 요약",
            summary: "카카오 2분기 실적 발표가 내일 예정되어 있어요.",
            summarySub: "실적 결과와 향후 성장 전략에 따라 단기적으로 주가 변동성이 확대될 수 있는 이벤트예요.",
            reasonsIcon: "📣", reasonsLabel: "무슨 일이 일어날까?",
            reasons: ["카카오는 이번 실적 발표를 통해 광고·커머스·콘텐츠 등 주요 사업 성과와 AI 기반 성장 전략을 함께 공개할 예정이에요.", "실적 수준이나 향후 전망에 따라 주가는 상승하거나 하락하는 등 변동성이 확대될 수 있어요."],
            sources: ["한국경제", "연합뉴스", "금융감독원 전자공시"], hideMasters: true,
            history: [
              { date: "2026.05", change: "-3~5%", direction: "down" as const, text: "역대 1분기 최대 실적을 기록했지만 기대 대비 부족과 AI 수익화 불확실성 영향으로 발표 이후 주가가 약 -3~5% 하락했어요." },
              { date: "2026.02", change: "-4%", direction: "down" as const, text: "실적이 시장 기대치를 일부 하회하며 발표 이후 주가가 약 -4% 하락했어요." },
              { date: "2025.11", change: "+3%", direction: "up" as const, text: "매출 증가 및 실적 개선에 따라 발표 이후 주가가 약 +3% 내외 상승했어요." },
            ],
          },
          kodex: {
            tag: "D-7", title: "KODEX 200 분배금 예정일",
            summaryIcon: "🤖", summaryLabel: "AI 이벤트 요약",
            summary: "분배금을 받을 예정이에요.",
            summarySub: "보유 수량 기준으로 분배금이 지급되며, 분배락일에는 분배금만큼 기준가격이 조정될 수 있어요.",
            reasonsIcon: "💰", reasonsLabel: "무슨 일이 일어날까?",
            reasons: ["KODEX 200의 분배금 지급 기준일이 도래하면서, 보유 수량에 따라 분배금이 지급될 예정이에요.", "분배락일에는 분배금 상당액만큼 ETF 기준가격이 조정될 수 있어요."],
            sources: ["삼성자산운용 공시", "한국거래소"], hideMasters: true,
            history: [
              { date: "2025.04", change: "주당 320원", direction: "up" as const, text: "2025년 4월 분배 기준일에 주당 약 320원이 지급되었어요." },
              { date: "2024.10", change: "주당 280원", direction: "up" as const, text: "2024년 10월 분배 기준일에 주당 약 280원이 지급되었어요." },
            ],
          },
          els: {
            tag: "D-7", title: "키움 뉴글로벌 100조 ELS 1888회",
            summaryIcon: "🤖", summaryLabel: "AI 이벤트 요약",
            summary: "테슬라·엔비디아 기초자산 ELS의 만기일이 다가오고 있어요.",
            summarySub: "만기 평가일 종가가 상환 조건을 충족하면 원금과 약정 수익이 함께 지급돼요.",
            reasonsIcon: "📣", reasonsLabel: "무슨 일이 일어날까?",
            reasons: ["만기 평가일에 두 기초자산 모두 최초 기준가격의 일정 비율 이상이면 약정 수익과 함께 원금이 상환돼요.", "조건을 충족하지 못하면 손실 구간에 해당되어 원금 손실이 발생할 수 있어요."],
            sources: ["한국예탁결제원", "발행 증권사 공시"], hideMasters: true,
          },
        };

        if (!activeHolding) return null;

        // schedule은 즉시, holding은 로딩 중이면 스피너 표시
        if (activeHolding.type === 'holding' && !holdingDetailProps) {
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="size-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                <span className="text-[13px] text-muted-foreground font-medium">분석 중...</span>
              </div>
            </div>
          );
        }

        const props = activeHolding.type === 'schedule'
          ? scheduleProps[activeHolding.key] ?? {}
          : holdingDetailProps ?? {};

        return (
          <HoldingDetailDialog
            key={activeHolding.key}
            open={true}
            onOpenChange={(o) => { if (!o) setActiveHolding(null); }}
            {...props}
          />
        );
      })()}
      <MarketEventDetailDialog
        open={!!activeMarketEventId}
        onOpenChange={(o) => { if (!o) setActiveMarketEventId(null); }}
        eventId={activeMarketEventId}
      />
    </div>
  );
}
