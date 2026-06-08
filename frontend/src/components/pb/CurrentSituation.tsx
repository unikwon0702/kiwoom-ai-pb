import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { tagClassName } from "./tag-style";
import { HoldingDetailDialog } from "./HoldingDetailDialog";
import { MarketEventDetailDialog } from "./MarketEventDetailDialog";
import { useHoldingSignals, useMarketEvents, useSchedules, useSituationSummary } from "@/hooks/useApiData";
import { useCustomer } from "@/lib/customer-context";
import { api } from "@/lib/api";

// 반말→요체 변환 (카드 desc 일관성)
function normalizeYo(text: string): string {
  if (!text) return text;
  const t = text.trimEnd();
  // 이미 요체면 그대로
  if (/[요죠]$/.test(t)) return text;
  // 반말 → 요체 변환 규칙 (길이가 긴 패턴 먼저!)
  const rules: [RegExp, string][] = [
    [/거야$/, '거예요'],
    [/이야$/, '이에요'],
    [/된다$/, '돼요'],
    [/돼$/, '돼요'],
    [/해$/, '해요'],
    [/져$/, '져요'],
    [/야$/, '예요'],
    [/어$/, '어요'],
    [/아$/, '아요'],
  ];
  for (const [pattern, replacement] of rules) {
    if (pattern.test(t)) return t.replace(pattern, replacement);
  }
  // fallback: "요" 붙이기
  return t + '요';
}
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
  eventId: string;
  dTag: string;
  date: string;
  title: string;
  desc: string;
};

function useCurrentSituationData(customerId: string): { holdings: Holding[]; markets: Market[]; schedules: Schedule[]; loading: boolean } {
  const { data: holdingsData, loading: hLoading } = useHoldingSignals(customerId, 5);
  const { data: marketsData, loading: mLoading } = useMarketEvents(customerId, 3);
  const { data: schedulesData, loading: sLoading } = useSchedules(3);

  const holdings: Holding[] = (holdingsData?.holdings ?? []).map((h: any, i: number) => {
    // enriched_sections가 있으면 구어체 사용
    let desc = h.signal_name ?? '';
    let subDesc = h.interpretation ?? '';
    if (h.enriched_sections) {
      try {
        const sec = typeof h.enriched_sections === 'string' ? JSON.parse(h.enriched_sections) : h.enriched_sections;
        if (sec.desc_friendly) desc = sec.desc_friendly;
        if (sec.subDesc_friendly) subDesc = sec.subDesc_friendly;
      } catch {}
    }
    return {
      tag: '보유',
      title: h.asset_name ?? '',
      time: getDisplayTime(h.date, i),
      desc,
      subDesc,
    };
  });

  const markets: Market[] = (marketsData?.events ?? []).map((e: any, i: number) => {
    // enriched opinions[0]를 desc로 우선 사용 (항상 요체)
    let desc = normalizeYo(e.ai_investment_view ?? '');
    if (e.enriched_sections) {
      try {
        const sec = typeof e.enriched_sections === 'string' ? JSON.parse(e.enriched_sections) : e.enriched_sections;
        if (sec.opinions && sec.opinions.length > 0) desc = normalizeYo(sec.opinions[0]);
      } catch {}
    }
    return {
      eventId: e.event_id ?? '',
      title: e.event_title ?? '',
      time: getDisplayTime(e.published_at, i + 5),
      desc,
      hashtags: [e.related_sector, e.primary_asset].filter(Boolean) as string[],
      relevance: e.impact_direction === '긍정' ? '보유 종목에 긍정적 영향이 예상돼요' : e.impact_direction === '부정' ? '보유 종목에 주의가 필요해요' : '보유·관심 자산과 관련이 높아요',
    };
  });

  const schedules: Schedule[] = (schedulesData?.schedules ?? []).map((s: any, i: number) => {
    // enriched로 구어체 title/desc 사용
    let title = s.event_title ?? '';
    let desc = s.event_summary ?? s.event_subtype ?? '';
    if (s.enriched_title) title = s.enriched_title;
    if (s.enriched_sections) {
      try {
        const sec = typeof s.enriched_sections === 'string' ? JSON.parse(s.enriched_sections) : s.enriched_sections;
        if (sec.title_friendly) title = sec.title_friendly;
        if (sec.desc_friendly) desc = sec.desc_friendly;
      } catch {}
    }
    return {
      eventId: s.event_id ?? '',
      dTag: `D-${i + 1}`,
      date: s.published_at ? new Date(s.published_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' }) : '',
      title,
      desc,
    };
  });

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

  // 일정 프리페치
  useEffect(() => {
    if (!schedules.length) return;
    schedules.forEach((s) => {
      if (!s.eventId || prefetchCache[`sched_${s.eventId}`]) return;
      api.getScheduleDetail(s.eventId)
        .then((data) => setPrefetchCache((prev) => ({ ...prev, [`sched_${s.eventId}`]: data })))
        .catch(() => {});
    });
  }, [schedules]);

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
    setActiveHolding({ type: 'schedule', key: it.eventId });
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
        const scheduleProps: Record<string, any> = {};

        if (!activeHolding) return null;

        // 데이터 없으면 스피너 표시 (holding: holdingDetailProps, schedule: prefetchCache)
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

        if (activeHolding.type === 'schedule' && !prefetchCache[`sched_${activeHolding.key}`]) {
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="size-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                <span className="text-[13px] text-muted-foreground font-medium">AI 분석 중...</span>
              </div>
            </div>
          );
        }

        const props = activeHolding.type === 'schedule'
          ? prefetchCache[`sched_${activeHolding.key}`] ?? {}
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
