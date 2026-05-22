import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer";
import { Drawer as DrawerPrimitive } from "vaul";
import { useNavigate } from "@tanstack/react-router";
import { X, Plus, Star, Wallet, TrendingUp, TrendingDown, ChevronDown, Info } from "lucide-react";
import { AiChatCta } from "./AiChatCta";
import { useState } from "react";
import { tagClassName } from "@/components/pb/tag-style";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  variant?: "oil" | "defense" | "starbucks";
};


type Asset = {
  name: string;
  type: string;
  impact: "positive" | "negative";
  note: string;
  holding?: "보유" | "관심";
};

type SectorTab = {
  label: string;
  impact: "positive" | "negative";
  assets: Asset[];
};

type Content = {
  tag: "호재" | "악재";
  summaryTitle: string;
  summaryBody: string;
  opinions: string[];
  sectorTabs: SectorTab[];
  indirect: Asset[];
};


const oilContent: Content = {
  tag: "호재",

  summaryTitle: "WTI 기준 국제 유가가 하루 만에 +2.4% 올랐어요.",
  summaryBody: "중동 리스크와 미국 원유 재고 감소가 겹치며 단기 수급 우려가 부각됐어요.",
  opinions: [
    "단기적으로 정유·에너지 섹터에 우호적인 흐름이 이어질 가능성이 높아요.",
    "유가가 더 오르면 인플레 부담으로 채권·성장주 변동성이 커질 수 있어요.",
  ],
  sectorTabs: [
    {
      label: "정유",
      impact: "positive",
      assets: [
        { name: "S-Oil", type: "주식", impact: "positive", note: "정제마진 확대로 분기 실적 개선 기대", holding: "관심" },
        { name: "TIGER 원유선물 ETF", type: "ETF", impact: "positive", note: "WTI 선물 직접 추종, 유가 상승 즉시 반영", holding: "관심" },
      ],
    },
    {
      label: "에너지",
      impact: "negative",
      assets: [
        { name: "한국전력", type: "주식", impact: "negative", note: "발전 연료비 부담 커져 실적에 부정적", holding: "보유" },

      ],
    },
  ],
  indirect: [
    { name: "글로벌 에너지 인컴 펀드", type: "펀드", impact: "positive", note: "에너지 섹터 비중 확대" },
    { name: "WTI 연계 ELS 32회차", type: "ELS", impact: "positive", note: "기초자산 안정 구간 진입" },
    { name: "국고채 10년물", type: "채권", impact: "negative", note: "인플레 우려로 금리 상승 압력" },
  ],
};

const defenseContent: Content = {
  tag: "호재",

  summaryTitle: "정부가 방산 산업 투자를 확대하기로 했어요.",
  summaryBody:
    "정부가 국방력 강화를 위해 방산 분야에 대한 예산을 확대하고, 첨단 무기체계 개발과 수출 지원을 강화하겠다고 발표했어요.",
  opinions: [
    "방산 예산 확대는 중장기적인 수주 증가로 이어질 가능성이 있어요.",
    "특히 정부 지원이 확대될 경우, 기술 경쟁력과 수출 기회를 동시에 확보할 수 있는 구조가 만들어질 수 있어요.",
  ],
  sectorTabs: [
    {
      label: "방산",
      impact: "positive",
      assets: [
        { name: "한화에어로스페이스", type: "주식", impact: "positive", note: "K9 자주포 수출 호조로 수주잔고 사상 최대", holding: "관심" },
        { name: "Plus K 방산", type: "ETF", impact: "positive", note: "국내 방산 대표주 한 번에 담는 패키지", holding: "관심" },
      ],
    },
    {
      label: "항공우주",
      impact: "positive",
      assets: [
        { name: "한국항공우주(KAI)", type: "주식", impact: "positive", note: "FA-50 수출 확대로 중장기 매출 성장 기대", holding: "관심" },

      ],
    },
  ],
  indirect: [
    { name: "국고채 10년", type: "채권", impact: "positive", note: "재정 확대 관련 수급 변화" },
    { name: "삼성 코리아 대표주 증권투자신탁", type: "펀드", impact: "positive", note: "대형주 정책 수혜 반영" },
    { name: "삼성전자·한국항공우주(KAI) 기초자산 ELS", type: "ELS", impact: "positive", note: "KAI 모멘텀으로 안정 구간" },
  ],
};

const starbucksContent: Content = {
  tag: "악재",
  summaryTitle: "스타벅스 코리아 마케팅 논란으로 불매 움직임이 확산되고 있어요.",
  summaryBody:
    "2026년 5월 18일 공개된 신규 캠페인이 특정 집단을 비하했다는 비판이 SNS에서 번지며, 본사가 사과문을 발표했지만 보이콧 해시태그가 실시간 검색어에 올랐어요.",
  opinions: [
    "최대주주인 신세계(이마트)는 단기 실적·브랜드 타격 우려로 매도 압력이 커질 수 있어요.",
    "이디야·컴포즈커피·메가커피 등 경쟁 프랜차이즈와 가성비 카페 관련주는 반사이익이 예상돼요.",
  ],
  sectorTabs: [
    {
      label: "같은 그룹 회사",
      impact: "negative",
      assets: [
        { name: "이마트", type: "주식", impact: "negative", note: "스타벅스 코리아 지분 67.5% 최대주주" },
        { name: "신세계", type: "주식", impact: "negative", note: "이마트 모회사, 그룹 브랜드 동반 타격" },
      ],
    },
    {
      label: "관련 있는 회사",
      impact: "negative",
      assets: [
        { name: "신세계푸드", type: "주식", impact: "negative", note: "스타벅스 매장 베이커리·간편식 납품사", holding: "보유" },
        { name: "신세계인터내셔날", type: "주식", impact: "negative", note: "스타벅스 MD·굿즈 협업 매출 위축" },
      ],
    },
    {
      label: "경쟁하는 회사",
      impact: "positive",
      assets: [
        { name: "이디야커피", type: "주식", impact: "positive", note: "이탈 수요 흡수, 가성비 카페 반사이익" },
        { name: "롯데웰푸드", type: "주식", impact: "positive", note: "엔제리너스 운영, 대체 수요 기대" },
      ],
    },
  ],

  indirect: [
    { name: "TIGER 여행레저 ETF", type: "ETF", impact: "negative", note: "외식·소비 섹터 비중 노출" },
    { name: "KODEX 필수소비재 ETF", type: "ETF", impact: "negative", note: "이마트·신세계푸드 편입 비중" },
    { name: "신세계 기초자산 ELS 14회차", type: "ELS", impact: "negative", note: "기초자산 변동성 확대 구간 진입" },
  ],
};

const historyMap: Record<"oil" | "defense" | "starbucks", { date: string; title: string; detail: string }[]> = {
  oil: [
    { date: "2024년 4월", title: "중동 긴장 고조로 유가 +5%", detail: "에너지 ETF 일주일간 +6.2%, 항공·운송주 약세 전환" },
    { date: "2023년 10월", title: "OPEC+ 감산 연장으로 유가 +3.8%", detail: "정유주 단기 강세, 채권 금리 0.15%p 상승" },
    { date: "2022년 6월", title: "러-우 사태로 유가 +8%", detail: "글로벌 인플레 가속, 성장주에서 가치주로 자금 이동" },
  ],
  defense: [
    { date: "2024년 4월", title: "중동 긴장 고조로 유가 +5%", detail: "에너지 ETF 일주일간 +6.2%, 항공·운송주 약세 전환" },
    { date: "2023년 10월", title: "OPEC+ 감산 연장으로 유가 +3.8%", detail: "정유주 단기 강세, 채권 금리 0.15%p 상승" },
    { date: "2022년 6월", title: "러-우 사태로 유가 +8%", detail: "글로벌 인플레 가속, 성장주에서 가치주로 자금 이동" },
  ],
  starbucks: [
    { date: "2023년 7월", title: "스타벅스 굿즈 품질 논란", detail: "신세계 주가 일주일간 -4.1%, 경쟁 카페 프랜차이즈 매출 +6%" },
    { date: "2021년 10월", title: "스타벅스 리유저블컵 대란", detail: "현장 운영 비판으로 SNS 보이콧 확산, 단기 매출 둔화" },
    { date: "2019년 9월", title: "외식 프랜차이즈 불매 운동", detail: "필수소비재 ETF -2.3%, 토종 브랜드 반사이익 뚜렷" },
  ],
};


function renderAsset(a: Asset, added: boolean, onToggle: () => void) {
  const positive = a.impact === "positive";
  const owned = a.holding === "보유";
  return (
    <li
      key={a.name}
      className="flex items-center gap-3 rounded-xl border border-border/60 px-3.5 py-3"
    >
      <span
        className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
          positive ? "bg-[color:var(--pos-soft)] text-[color:var(--pos)]" : "bg-[color:var(--neg-soft)] text-[color:var(--neg)]"
        }`}
      >
        {positive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13.5px] font-semibold text-foreground truncate">{a.name}</span>
          <span className="text-[10.5px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60 shrink-0">
            {a.type}
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground mt-0.5 whitespace-nowrap">{a.note}</p>
      </div>
      {owned ? (
        <span className="shrink-0 flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1.5 rounded-full bg-[color:var(--brand)] text-white border border-[color:var(--brand)]">
          <Wallet className="size-3" />
          보유
        </span>
      ) : (
        <button
          onClick={onToggle}
          aria-label={added ? "관심종목 제거" : "관심종목 추가"}
          className={`shrink-0 flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
            added
              ? "bg-[color:var(--brand-sub)] text-white border-[color:var(--brand-sub)]"
              : "bg-card text-foreground/80 border-border/60 hover:bg-muted/40"
          }`}
        >
          {added ? <Star className="size-3 fill-current" /> : <Plus className="size-3" />}
          관심
        </button>
      )}
    </li>
  );
}

export function MarketEventDialog({ open, onOpenChange, title = "국제 유가 +2.4% 상승", variant = "oil" }: Props) {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set(["TIGER 원유선물 ETF", "Plus K 방산"]));
  const [showHistory, setShowHistory] = useState(false);
  const [showIndirect, setShowIndirect] = useState(false);
  const content = variant === "defense" ? defenseContent : variant === "starbucks" ? starbucksContent : oilContent;
  const history = historyMap[variant];

  const [activeTab, setActiveTab] = useState(0);
  const tab = content.sectorTabs[activeTab] ?? content.sectorTabs[0];

  const toggle = (name: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const goChat = () => {
    onOpenChange(false);
    navigate({ to: "/chat" });
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
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${tagClassName(content.tag)}`}>
                  {content.tag}
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

            {/* 이벤트 요약 */}
            <section className="space-y-2">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
                <span>📌</span>
                <span>이벤트 요약</span>
              </div>
              <p className="text-[16px] font-bold text-foreground leading-snug">{content.summaryTitle}</p>
              <p className="text-[13.5px] text-muted-foreground leading-relaxed">{content.summaryBody}</p>
            </section>

            {/* AI PB 의견 */}
            <section className="space-y-2">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
                <span>🤖</span>
                <span>AI PB 의견</span>
              </div>
              <ul className="space-y-2 text-[14px] text-foreground/90 leading-relaxed">
                {content.opinions.map((op) => (
                  <li key={op} className="flex gap-2">
                    <span className="text-muted-foreground/60 mt-1.5 size-1 rounded-full bg-current shrink-0" />
                    <span>{op}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 섹터 탭 */}
            <section className="space-y-3">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
                <span>🧭</span>
                <span>어떤 섹터에 영향을 줄까요?</span>
              </div>
              <div className="flex gap-2">
                {content.sectorTabs.map((s, i) => {
                  const isActive = i === activeTab;
                  const positive = s.impact === "positive";
                  return (
                    <button
                      key={s.label}
                      onClick={() => setActiveTab(i)}
                      className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1 text-[12px] font-semibold px-2 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                        isActive
                          ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]"
                          : "bg-card text-foreground/80 border-border/60"
                      }`}
                    >
                      <span>{s.label}</span>
                      <span className={`inline-flex items-center text-[11px] ${
                        isActive
                          ? "opacity-90"
                          : positive ? "text-[color:var(--pos)]" : "text-[color:var(--neg)]"
                      }`}>
                        {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground/80 mt-1">
                <span className="text-[color:var(--pos)]">💹</span>
                <span>{tab.label} 섹터 관련 주식·ETF</span>
              </div>
              <ul className="space-y-2">
                {tab.assets.map((a) => renderAsset(a, watchlist.has(a.name), () => toggle(a.name)))}
              </ul>
            </section>

            {/* 영향을 받을 수 있는 금융상품 */}
            <section className="space-y-3">
              <button
                onClick={() => setShowIndirect((v) => !v)}
                className="w-full flex items-center justify-between text-[12px] font-semibold text-muted-foreground tracking-wide"
              >
                <span className="flex items-center gap-1.5">
                  <span>🔗</span>
                  <span>영향을 받을 수 있는 금융상품</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label="설명"
                      >
                        <Info className="size-3.5" />
                      </span>
                    </PopoverTrigger>
                    <PopoverContent
                      side="top"
                      align="start"
                      className="w-[240px] text-[12px] leading-relaxed"
                      onClick={(e) => e.stopPropagation()}
                    >
                      여러 자산에 투자되어 있어 기초자산을 통해 영향을 받을 수 있어요
                    </PopoverContent>
                  </Popover>
                </span>
                <ChevronDown className={`size-4 transition-transform ${showIndirect ? "rotate-180" : ""}`} />
              </button>
              {showIndirect && (
                <ul className="space-y-2">
                  {content.indirect.map((a) => renderAsset(a, watchlist.has(a.name), () => toggle(a.name)))}
                </ul>
              )}
            </section>

            {/* 유사 이벤트 히스토리 */}
            <section className="space-y-3">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="w-full flex items-center justify-between text-[12px] font-semibold text-muted-foreground tracking-wide"
              >
                <span className="flex items-center gap-1.5">
                  <span>🕘</span>
                  <span>비슷한 상황에서는 시장이 이렇게 움직였어요</span>
                </span>
                <ChevronDown className={`size-4 transition-transform ${showHistory ? "rotate-180" : ""}`} />
              </button>
              {showHistory && (
                <ol className="relative space-y-3 pl-4 before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-px before:bg-border">
                  {history.map((h) => (
                    <li key={h.title} className="relative">
                      <span className="absolute -left-[14px] top-1.5 size-2 rounded-full bg-foreground/70" />
                      <div className="text-[11.5px] text-muted-foreground">{h.date}</div>
                      <div className="text-[13.5px] font-semibold text-foreground mt-0.5 leading-snug">{h.title}</div>
                      <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-1">{h.detail}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <AiChatCta onClick={goChat} />
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
