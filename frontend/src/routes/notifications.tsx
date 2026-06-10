import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Fragment, useState } from "react";
import { tagClassName } from "@/components/pb/tag-style";
import { HoldingDetailDialog } from "@/components/pb/HoldingDetailDialog";
import { EventDetailDialog } from "@/components/pb/EventDetailDialog";
import { useHoldingSignals, useMarketEvents, useSchedules } from "@/hooks/useApiData";
import { useCustomer } from "@/lib/customer-context";
import { getDisplayTime } from "@/lib/date";

type TabKey = "holdings" | "market" | "schedule";

export const Route = createFileRoute("/notifications")({
  validateSearch: (search: Record<string, unknown>): { tab?: TabKey } => {
    const t = search.tab;
    return { tab: t === "market" || t === "schedule" || t === "holdings" ? t : undefined };
  },
  component: NotificationsPage,
});

type Holding = {
  tag: string;
  title: string;
  time: string;
  desc: string;
  subDesc?: string;
  read?: boolean;
};

type Market = {
  title: string;
  time: string;
  desc: string;
  hashtags: string[];
  relevance?: string;
  read?: boolean;
};

type Schedule = {
  dTag: string;
  date: string;
  title: string;
  desc: string;
  read?: boolean;
};

const tabs: { key: TabKey; label: string }[] = [
  { key: "holdings", label: "내 투자 변동" },
  { key: "market", label: "지금뜨는 이벤트·시황" },
  { key: "schedule", label: "다가오는 일정" },
];

function CardShell({ children, onClick, read }: { children: React.ReactNode; onClick?: () => void; read?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border px-4 py-3.5 transition-colors ${
        read
          ? "bg-[oklch(0.96_0.005_260)] border-[oklch(0.92_0.005_260)] hover:bg-[oklch(0.94_0.005_260)]"
          : "bg-card border-border/60 hover:bg-muted/30"
      }`}
    >
      {children}
    </button>
  );
}

function HoldingRow({ it, onClick }: { it: Holding; onClick?: () => void }) {
  return (
    <CardShell onClick={onClick} read={it.read}>
      <div className="flex items-center gap-2">
        <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 min-w-[34px] text-center ${tagClassName(it.tag)}`}>
          {it.tag}
        </span>
        <span className="flex-1 text-[14.5px] font-bold text-foreground truncate">{it.title}</span>
        <span className="text-[12px] text-foreground/60 shrink-0">{it.time}</span>
      </div>
      <p className="mt-1.5 pl-[42px] text-[13px] text-foreground/85 leading-[1.5]">{it.desc}</p>
      {it.subDesc && (
        <p className="mt-1 pl-[42px] text-[12.5px] text-muted-foreground leading-[1.5]">{it.subDesc}</p>
      )}
    </CardShell>
  );
}

function MarketRow({ it, onClick }: { it: Market; onClick?: () => void }) {
  const hashtagsFirst = !it.relevance;
  const hashtagBlock = (
    <div className="mt-1 flex items-center flex-wrap gap-x-2 gap-y-1">
      {hashtagsFirst && <span className="text-[12px]">🎯</span>}
      {it.hashtags.map((h) => (
        <span key={h} className="text-[12px] text-[color:var(--brand)]">#{h}</span>
      ))}
    </div>
  );
  return (
    <CardShell onClick={onClick} read={it.read}>
      <div className="flex items-start gap-2">
        <span className="flex-1 text-[14.5px] font-bold text-foreground">{it.title}</span>
        <span className="text-[12px] text-foreground/60 shrink-0 mt-0.5">{it.time}</span>
      </div>
      {hashtagsFirst ? (
        <>
          {hashtagBlock}
          <p className="mt-1 text-[13px] text-foreground/85 leading-[1.5]">{it.desc}</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-foreground/85 leading-[1.5]">{it.desc}</p>
          {hashtagBlock}
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="text-[12px]">🎯</span>
            <span>{it.relevance}</span>
          </div>
        </>
      )}
    </CardShell>
  );
}

function ScheduleRow({ it, onClick }: { it: Schedule; onClick?: () => void }) {
  return (
    <CardShell onClick={onClick} read={it.read}>
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

function NotificationsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const [active, setActive] = useState<TabKey>(tab ?? "holdings");
  const [openSamsung, setOpenSamsung] = useState(false);
  const [openKcgi, setOpenKcgi] = useState(false);
  const [openOil, setOpenOil] = useState(false);

  // Fetch data from API
  const { customer } = useCustomer();
  const { data: holdingsRaw } = useHoldingSignals(customer.id, 10);
  const { data: marketsRaw } = useMarketEvents(customer.id, 10);
  const { data: schedulesRaw } = useSchedules(customer.id, 10);

  const holdingsItems: Holding[] = (holdingsRaw?.holdings ?? []).map((h: any, i: number) => ({
    tag: h.holding_type === '관심' ? '관심' : '보유',
    title: h.asset_name ?? '',
    time: h.time_label ?? getDisplayTime(h.date, i),
    desc: h.ai_summary ?? h.signal_name ?? '',
    subDesc: h.interpretation ?? undefined,
  }));

  const marketItems: Market[] = (marketsRaw?.events ?? []).map((e: any, i: number) => ({
    title: e.event_title ?? '',
    time: getDisplayTime(e.published_at, i + 5),
    desc: e.ai_investment_view ?? e.related_sector ?? '',
    hashtags: [e.related_sector, e.event_type].filter(Boolean) as string[],
    relevance: '내가 보유·관심으로 등록한 자산과 관련이 높아요',
  }));

  const scheduleItems: Schedule[] = (schedulesRaw?.schedules ?? []).map((s: any) => ({
    dTag: s.d_days != null ? `D-${s.d_days}` : 'D-?',
    date: s.scheduled_date
      ? new Date(s.scheduled_date + 'T00:00:00').toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' })
      : '',
    title: s.event_title ?? '',
    desc: s.event_summary ?? '',
  }));

  return (
    <div className="min-h-screen bg-surface-muted">
      <div className="max-w-[480px] mx-auto bg-surface-muted">
        <header className="sticky top-0 z-10 bg-surface-muted/85 backdrop-blur-md">
          <div className="flex items-center justify-between px-2 h-14">
            <Link
              to="/"
              className="size-9 flex items-center justify-center rounded-full hover:bg-muted text-foreground/70"
            >
              <ChevronLeft className="size-5" />
            </Link>
            <Link
              to="/product-history"
              className="mr-2 inline-flex items-center gap-1 text-[12.5px] font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-[oklch(0.55_0.18_255)] to-[oklch(0.6_0.16_280)] text-white shadow-sm hover:opacity-90 transition-opacity"
            >
              <Sparkles className="size-3.5" />
              내 자산 알림 모아보기
            </Link>
          </div>
        </header>

        <div className="px-5 pt-2 pb-5">
          <h1 className="text-[20px] font-bold tracking-tight text-foreground">알림 피드</h1>
          <p className="text-[13px] text-muted-foreground mt-1">오늘 받은 알림을 모아봤어요</p>
        </div>

        <div className="px-5">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
            {tabs.map((t) => {
              const isActive = t.key === active;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setActive(t.key);
                    navigate({ to: "/notifications", search: { tab: t.key }, replace: true });
                  }}
                  className={`shrink-0 text-[13px] font-medium px-3.5 py-2 rounded-full border transition-colors ${
                    isActive
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground border-border/70 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <main className="px-5 pt-4 pb-10">
          {active === "holdings" && (
            <FeedList
              items={holdingsItems}
              render={(it) => (
                <HoldingRow
                  it={it}
                  onClick={() => {
                    if (it.title === "삼성전자") setOpenSamsung(true);
                    else if (it.title === "KCGI코리아증권투자신탁") setOpenKcgi(true);
                  }}
                />
              )}
            />
          )}
          {active === "market" && (
            <FeedList
              items={marketItems}
              render={(it) => (
                <MarketRow
                  it={it}
                  onClick={() => {
                    if (it.title === "국제 유가 +2.4%") setOpenOil(true);
                  }}
                />
              )}
            />
          )}
          {active === "schedule" && (
            <FeedList items={scheduleItems} render={(it) => <ScheduleRow it={it} />} />
          )}

          <button className="w-full mt-6 text-center text-[13px] text-muted-foreground hover:text-foreground transition-colors">
            이전 알림 더보기 →
          </button>
        </main>

        <HoldingDetailDialog
          open={openSamsung}
          onOpenChange={setOpenSamsung}
          buyCount={2}
          sellCount={1}
          pollLabel="매수 우위"
          aiPbSummary="고수 3팀 중 2팀이 매수에 무게를 두며 단기 매수 흐름이 우세해요."
          masters={[
            { emoji: "🔥", name: "공격형 고수", note: "추가 매수 진행 중", action: "매수" },
            { emoji: "💎", name: "장기형 고수", note: "장기 보유 유지", action: "매수" },
            { emoji: "🏅", name: "금상 고수", note: "일부 차익 실현", action: "매도" },
          ]}
        />
        <HoldingDetailDialog
          open={openKcgi}
          onOpenChange={setOpenKcgi}
          tag="보유"
          title="KCGI코리아증권투자신탁"
          summary="운용성과가 기대만큼 나오지 않았어요."
          summarySub="코스피 대비 수익률이 한 달간 약 -5.5% 낮은 상태예요."
          chart={{
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
          }}
          reasons={[
            "반도체 중심 상승으로 코스피가 빠르게 올랐어요.",
            "해당 펀드는 반도체 비중이 낮아 수익률 격차가 벌어졌어요.",
          ]}
          sources={["한국경제", "연합뉴스", "금융감독원 전자공시"]}
          buyCount={0}
          sellCount={1}
          pollLabel="매수 우위"
          aiPbSummary="고수 1명 중 0명이 매수에 무게를 두며 단기 추가 매수 흐름이 우세해요."
          masters={[{ emoji: "🏅", name: "금상 고수", note: "일부 환매", action: "매도" }]}
        />
        <EventDetailDialog open={openOil} onOpenChange={setOpenOil} eventId={null} />
      </div>
    </div>
  );
}

function FeedList<T extends { read?: boolean; title: string }>({
  items,
  render,
}: {
  items: T[];
  render: (it: T) => React.ReactNode;
}) {
  const sorted = [...items].sort((a, b) => Number(a.read) - Number(b.read));
  const dividerIdx = sorted.findIndex((it) => it.read);
  return (
    <ul className="space-y-2">
      {sorted.map((it, idx) => (
        <Fragment key={`${it.title}-${idx}`}>
          {idx === dividerIdx && dividerIdx > 0 && (
            <li className="pt-3 pb-1 text-center text-[11.5px] text-muted-foreground/60 tracking-wide">
              — 이전 알림 —
            </li>
          )}
          <li>{render(it)}</li>
        </Fragment>
      ))}
    </ul>
  );
}
