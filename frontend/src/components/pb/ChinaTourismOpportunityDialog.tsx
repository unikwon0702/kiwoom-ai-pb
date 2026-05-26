import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer";
import { Drawer as DrawerPrimitive } from "vaul";

import {
  X,
  TrendingUp,
  ShoppingBag,
  Sparkles,
  Plane,
} from "lucide-react";

import { useState } from "react";
import { tagClassName } from "@/components/pb/tag-style";

function SectionTitle({ icon, children }: { icon?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Asset = {
  name: string;
  type: string;
  reason: string;
};

type Sector = {
  key: string;
  label: string;
  icon: React.ReactNode;
  why: string;
  assets: Asset[];
};

const insights = [
  {
    tag: "여객 급증",
    body: "인천공항 중국 노선 주간 입국객이 한 달 전 대비 +42% 늘면서 중국발 소비 회복이 본격화되고 있어요.",
  },
  {
    tag: "객단가 회복",
    body: "유커 1인당 면세점 평균 결제액이 코로나 이전의 92% 수준까지 회복됐어요.",
  },
  {
    tag: "K-뷰티 수요",
    body: "중국 SNS에서 한국 화장품 해시태그 노출이 3개월째 두 자릿수로 늘고 있어요.",
  },
];

const sectors: Sector[] = [
  {
    key: "duty-free",
    label: "면세·유통",
    icon: <ShoppingBag className="size-4" />,
    why: "유커 귀환으로 면세·패션 매출 회복이 가장 빠르게 나타나는 구간",
    assets: [
      { name: "호텔신라", type: "주식", reason: "시내 면세점 매출 비중 최대" },
      { name: "F&F", type: "주식", reason: "MLB 등 중국 인기 브랜드, 유커 직접 구매 급증" },
      { name: "TIGER 여행레저", type: "ETF", reason: "면세·여행 종합 익스포저" },
    ],
  },
  {
    key: "beauty",
    label: "화장품",
    icon: <Sparkles className="size-4" />,
    why: "중국 인바운드 + 따이공 채널 회복으로 K-뷰티 실적 레버리지 확대",
    assets: [
      { name: "아모레퍼시픽", type: "주식", reason: "설화수·라네즈 중국 매출 반등" },
      { name: "LG생활건강", type: "주식", reason: "후 브랜드 면세 채널 회복" },
      { name: "코스맥스", type: "주식", reason: "중국 ODM 수주 증가" },
    ],
  },
  {
    key: "travel",
    label: "여행·카지노",
    icon: <Plane className="size-4" />,
    why: "외국인 전용 카지노·항공·호텔 객실 가동률 동반 상승",
    assets: [
      { name: "파라다이스", type: "주식", reason: "VIP 드롭액 분기 최대치" },
      { name: "GKL", type: "주식", reason: "중국·일본 VIP 방문 회복" },
      { name: "하나투어", type: "주식", reason: "인바운드·아웃바운드 동시 회복" },
    ],
  },
];

const relatedFunds = [
  { name: "한국 컨슈머 리오프닝 펀드", type: "펀드", reason: "면세·화장품·여행 비중 40% 이상" },
  { name: "K-뷰티 ELS 8회차", type: "ELS", reason: "아모레퍼시픽·LG생건 기초자산" },
];

export function ChinaTourismOpportunityDialog({ open, onOpenChange }: Props) {
  const [activeSector, setActiveSector] = useState(0);
  const sector = sectors[activeSector];


  const renderAsset = (a: Asset) => {
    return (
      <li
        key={a.name}
        className="flex items-center gap-3 rounded-xl border border-border/60 px-3.5 py-3"
      >
        <span className="size-8 rounded-full flex items-center justify-center shrink-0 bg-[color:var(--pos-soft)] text-[color:var(--pos)]">
          <TrendingUp className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13.5px] font-semibold text-foreground truncate">{a.name}</span>
            <span className="text-[10.5px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60 shrink-0">
              {a.type}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{a.reason}</p>
        </div>
      </li>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[24px] border bg-background max-w-[480px] mx-auto focus:outline-none">
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 rounded-full bg-muted" />

          <DrawerPrimitive.Title className="sr-only">의외의 투자 기회</DrawerPrimitive.Title>

          <div className="px-6 pt-4 pb-3 space-y-7 max-h-[78vh] overflow-y-auto">
            {/* 헤더 */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${tagClassName("호재")}`}>
                    의외의 기회
                  </span>
                </div>
                <h2 className="text-[19px] font-bold tracking-tight text-foreground leading-snug">
                  중국 유커가 다시 온다,<br />면세·화장품·카지노 재점화
                </h2>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                aria-label="닫기"
                className="size-8 -mr-1 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <X className="size-4.5" />
              </button>
            </div>

            {/* WHY NOW */}
            <section className="space-y-3">
              <SectionTitle icon="⚡">지금 왜 주목해야 할까요?</SectionTitle>
              <div className="rounded-2xl bg-[color:var(--neg-soft)]/40 border border-[color:var(--neg)]/20">
              <div className="rounded-[14px] p-5 space-y-3">
                <p className="text-[15px] font-bold text-foreground leading-snug">
                  인천공항에 중국발 입국객이 빠르게 늘고 있어요.
                </p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  최근 주간 중국 노선 입국 여객이 <span className="font-semibold text-foreground">+42%</span> 급증하면서
                  <span className="font-semibold text-foreground"> 면세 유통 → 화장품 → 여행·카지노</span>로 이어지는 소비 회복 수혜가 다시 부각되고 있어요.
                </p>

                {/* 흐름도 */}
                <div className="flex items-center justify-between gap-1.5 pt-2">
                  {[
                    { k: "유커 ↑", v: "🛬" },
                    { k: "면세 ↑", v: "🛍️" },
                    { k: "카지노 ↑", v: "🎰" },
                  ].map((s, i) => (
                    <div key={s.k} className="flex items-center gap-1.5 flex-1">
                      <div className="flex-1 flex flex-col items-center gap-1 rounded-xl bg-card border border-border/60 py-2.5">
                        <span className="text-[18px]">{s.v}</span>
                        <span className="text-[11px] font-semibold text-foreground">{s.k}</span>
                      </div>
                      {i < 2 && <span className="text-muted-foreground text-[14px]">→</span>}
                    </div>
                  ))}
                </div>

                {/* 미니 그래프 */}
                <div className="rounded-xl bg-card border border-border/60 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12.5px] font-semibold text-foreground">중국 노선 주간 입국객 (4주)</span>
                    <span className="text-[16px] font-bold text-[color:var(--pos)]">+42.1%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">단위: 만 명 / 주 · 인천공항 중국 노선 기준</p>
                  <div className="flex gap-1.5">
                    <div className="flex flex-col justify-between text-[9px] text-muted-foreground py-0.5 shrink-0">
                      <span>30</span>
                      <span>20</span>
                      <span>10</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="w-full h-32">
                        <g className="text-[color:var(--pos)]">
                          <path
                            d="M0,82 L33,74 L66,64 L99,50 L132,38 L165,22 L200,8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                          {[
                            [0, 82], [33, 74], [66, 64], [99, 50], [132, 38], [165, 22], [200, 8],
                          ].map(([x, y]) => (
                            <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" fill="currentColor" />
                          ))}
                        </g>
                      </svg>
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                        {["4주전", "3주전", "2주전", "1주전", "이번주"].map((d) => (
                          <span key={d}>{d}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </section>


            {/* 인사이트 */}
            <section className="space-y-3">
              <SectionTitle icon="💡">이런 흐름이 보여요</SectionTitle>
              <ul className="space-y-2">
                {insights.map((it) => (
                  <li
                    key={it.tag}
                    className="flex items-start gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3"
                  >
                    <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md bg-[color:var(--brand-sub)] text-white">
                      {it.tag}
                    </span>
                    <p className="text-[13px] text-foreground/90 leading-relaxed">{it.body}</p>
                  </li>
                ))}
              </ul>
            </section>

            {/* 수혜 섹터 */}
            <section className="space-y-3">
              <SectionTitle icon="🎯">어떤 종목이 움직일까요?</SectionTitle>
              <p className="text-[12.5px] text-muted-foreground leading-relaxed px-1 -mt-1">
                유커 귀환과 직간접적으로 연결된 섹터의 대표 자산을 모았어요.
              </p>

              <div className="flex gap-2">
                {sectors.map((s, i) => {
                  const isActive = i === activeSector;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setActiveSector(i)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold px-2 py-2 rounded-full border transition-colors ${
                        isActive
                          ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]"
                          : "bg-card text-foreground/80 border-border/60"
                      }`}
                    >
                      {s.icon}
                      #{s.label}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1.5 px-1">
                <p className="text-[13px] font-semibold text-foreground">왜 연관 있나요?</p>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                  {sector.why}
                </p>
              </div>

              <ul className="space-y-2">{sector.assets.map(renderAsset)}</ul>
            </section>

            {/* 금융상품 */}
            <section className="space-y-3">
              <SectionTitle icon="🔗">함께 보면 좋은 금융상품</SectionTitle>
              <ul className="space-y-2">{relatedFunds.map(renderAsset)}</ul>
            </section>

            {/* 리스크 */}
            <section className="space-y-2">
              <SectionTitle icon="⚠️">투자 전 꼭 확인하세요</SectionTitle>
              <div className="rounded-xl bg-[color:var(--neg-soft)]/40 border border-[color:var(--neg)]/20 px-4 py-3 space-y-1.5">
                <p className="text-[12.5px] text-foreground/90 leading-relaxed">
                  • 중국 단체관광 정책 변화에 따라 회복 속도가 달라질 수 있어요.
                </p>
                <p className="text-[12.5px] text-foreground/90 leading-relaxed">
                  • 이미 리오프닝 기대가 선반영된 종목은 단기 변동성이 커질 수 있어요.
                </p>
              </div>
            </section>
          </div>

        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
