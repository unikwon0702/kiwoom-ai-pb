import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Fragment, useState } from "react";
import { tagClassName } from "@/components/pb/tag-style";
import { HoldingDetailDialog } from "@/components/pb/HoldingDetailDialog";
import { MarketEventDialog } from "@/components/pb/MarketEventDialog";

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

const holdingsItems: Holding[] = [
  { tag: "보유", title: "삼성전자", time: "방금", desc: "외국인 투자자들이 많이 사들이고 있어요", subDesc: "HBM 수요 확대와 메모리 가격 반등 기대가 매수세를 자극하고 있어요" },
  { tag: "관심", title: "PLUS K 방산", time: "7분 전", desc: "실시간 종목 8위를 기록했어요", subDesc: "정부 방산 수출 지원 확대 발표로 관련 ETF에 자금이 몰리고 있어요" },
  { tag: "보유", title: "KCGI코리아증권투자신탁", time: "10분 전", desc: "운용성과가 기대만큼 나오지 않았어요", subDesc: "반도체 비중이 낮아 코스피 상승 대비 수익률 격차가 벌어졌어요" },
  { tag: "보유", title: "현대차", time: "12분 전", desc: "외국인 순매수 1위, 기관도 동반 매수 중", subDesc: "북미 친환경차 판매 호조와 환율 효과로 실적 기대가 커지고 있어요" },
  { tag: "관심", title: "SK하이닉스", time: "15분 전", desc: "메모리 가격 상승 기대감에 강한 매수세", subDesc: "AI 서버용 HBM3E 공급 확대 소식이 외국인 매수를 끌어들이고 있어요" },
  { tag: "보유", title: "카카오", time: "20분 전", desc: "실적 개선 기대감으로 개인투자자 매수 증가", subDesc: "광고·커머스 회복과 AI 신사업 모멘텀이 동시에 반영되고 있어요" },
  { tag: "보유", title: "네이버", time: "25분 전", desc: "광고 매출 호조에 기관 매수세 유입", read: true },
  { tag: "관심", title: "LG에너지솔루션", time: "30분 전", desc: "2차전지 수요 회복 기대감", read: true },
  { tag: "보유", title: "셀트리온", time: "35분 전", desc: "바이오시밀러 승인 호재에 상승세", subDesc: "미국 FDA 추가 적응증 승인으로 매출 확대 기대가 반영되고 있어요", read: true },
  { tag: "보유", title: "POSCO홀딩스", time: "40분 전", desc: "철강 수출 증가 기대감에 강세", read: true },
];

const marketItems: Market[] = [
  { title: "국제 유가 +2.4%", time: "방금", desc: "에너지 업종 강세 가능", hashtags: ["에너지", "유가"], relevance: "내가 보유·관심으로 등록한 자산과 관련이 높아요" },
  { title: "스타벅스 마케팅 논란 확산", time: "20분 전", desc: "보이콧 움직임에 신세계·이마트 단기 약세, 경쟁 카페 반사이익", hashtags: ["소비", "외식"], relevance: "내가 보유한 자산과 관련이 높아요" },
  { title: "정부 방산 산업 투자 확대 결정", time: "2시간 전", desc: "국내 방산 기업 전반에 대한 기대감 상승", hashtags: ["방산", "정책"], relevance: "내가 관심으로 등록한 자산과 관련이 높아요" },
  { title: "미국 CPI 3.2% 상승", time: "방금", desc: "금리 인하 기대감 확대", hashtags: ["CPI", "인플레"], relevance: "내가 보유한 자산과 관련이 높아요" },
  { title: "중국 PMI 50.3 회복", time: "30분 전", desc: "중국 소비 관련주 주목", hashtags: ["중국", "소비"] },
  { title: "금리 인하 기대감 확산", time: "40분 전", desc: "성장주 및 테크 섹터 강세", hashtags: ["금리", "성장주"], relevance: "내가 관심으로 등록한 자산과 관련이 높아요" },
  { title: "반도체 수출 +15% 증가", time: "50분 전", desc: "D램 가격 상승세 지속", hashtags: ["반도체", "D램"], read: true },
  { title: "유럽중앙은행(ECB) 금리 동결", time: "1시간 전", desc: "글로벌 유동성 개선 기대", hashtags: ["ECB", "통화정책"], relevance: "내가 보유·관심으로 등록한 자산과 관련이 높아요", read: true },
  { title: "일본 엔화 약세 지속", time: "1시간 전", desc: "일본 수출주 경쟁력 상승", hashtags: ["엔화", "일본"], read: true },
  { title: "러시아·우크라이나 긴장 완화", time: "2시간 전", desc: "원자재 가격 안정화 기대", hashtags: ["원자재", "지정학"], relevance: "내가 보유한 자산과 관련이 높아요", read: true },
];

const scheduleItems: Schedule[] = [
  { dTag: "D-1", date: "05/22(금)", title: "카카오 2분기 실적보고 발표", desc: "광고·커머스 성과와 AI 성장 전략 공개 예정" },
  { dTag: "D-2", date: "05/23(토)", title: "KODEX 200 분배금 예정일", desc: "보유 수량 기준 분배금 입금 예정" },
  { dTag: "D-7", date: "05/28(목)", title: "키움 뉴글로벌 100조 ELS 1888회", desc: "기초자산 종가에 따라 상환 여부 결정" },
  { dTag: "D-3", date: "05/24(일)", title: "한국은행 금융통화위원회", desc: "기준금리 결정 주목" },
  { dTag: "D-4", date: "05/25(월)", title: "미국 연준 FOMC 의사록 공개", desc: "금리 인하 시점 점검" },
  { dTag: "D-5", date: "05/26(화)", title: "삼성SDI 주주총회", desc: "배터리 사업 전략 확인", read: true },
  { dTag: "D-6", date: "05/27(수)", title: "현대차 인적분할 기일", desc: "기업가치 재평가 주목", read: true },
  { dTag: "D-8", date: "05/29(목)", title: "LG화학 이사회", desc: "신소재 사업 방향성 점검", read: true },
  { dTag: "D-9", date: "05/30(금)", title: "SK이노베이션 실적발표", desc: "정유·배터리 실적 확인", read: true },
  { dTag: "D-10", date: "05/31(일)", title: "POSCO 인적분할 기일", desc: "철강 사업 구조 개편", read: true },
];

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
          buyCount={4}
          sellCount={1}
          pollLabel="매수 우위"
          aiPbSummary="고수 5명 중 4명이 매수에 무게를 두며 단기 추가 매수 흐름이 우세해요."
          masters={[
            { emoji: "🔥", name: "공격형 고수", note: "추가 매수 진행 중", action: "매수" },
            { emoji: "📈", name: "트렌드형 고수", note: "비중 확대", action: "매수" },
            { emoji: "💎", name: "장기형 고수", note: "장기 보유 유지", action: "매수" },
            { emoji: "🧾", name: "절세 고수", note: "세제 혜택 고려 매수", action: "매수" },
            { emoji: "🔍", name: "분석형 고수", note: "일부 차익 실현", action: "매도" },
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
          masters={[{ emoji: "💎", name: "금융상품 고수", note: "일부 환매", action: "매도" }]}
        />
        <MarketEventDialog open={openOil} onOpenChange={setOpenOil} />
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
