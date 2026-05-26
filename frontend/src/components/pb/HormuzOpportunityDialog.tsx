import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer";
import { Drawer as DrawerPrimitive } from "vaul";

import {
  X,
  TrendingUp,
  Ship,
  Anchor,
  Factory,
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
  holding?: "보유" | "관심";
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
    tag: "운임 급등",
    body: "원유를 실어나르는 비용이 일주일 만에 28% 올라 해운 관련 주가에 긍정적인 영향을 줄 수 있어요.",
  },
  {
    tag: "수주 회복",
    body: "탱커 신조 수요가 늘면서 국내 조선 빅3에 대형 발주 문의가 이어지고 있어요.",
  },
  {
    tag: "우회 항로",
    body: "호르무즈 우회 항로가 멀리 돌아서 운반할수록 운송량이 늘고, 해운사 이익도 더 커질 수 있어요.",
  },
];


const sectors: Sector[] = [
  {
    key: "shipping",
    label: "해운",
    icon: <Ship className="size-4" />,
    why: "원유 수송 경로 리스크로 운임이 급등, 탱커 선사 실적 개선 가시화",
    assets: [
      { name: "HMM", type: "주식", reason: "벌크·탱커 운임 동반 강세", holding: "관심" },
      { name: "팬오션", type: "주식", reason: "장기 용선 계약 비중 높아 안정적 수익" },
      { name: "KODEX 해운", type: "ETF", reason: "국내 해운 종합 익스포저" },
    ],
  },
  {
    key: "shipbuilding",
    label: "조선",
    icon: <Anchor className="size-4" />,
    why: "탱커 수요 회복 + 친환경 선박 교체 사이클 진입",
    assets: [
      { name: "HD현대중공업", type: "주식", reason: "LNG·탱커 수주 잔고 사상 최대", holding: "보유" },
      { name: "삼성중공업", type: "주식", reason: "해양플랜트 수주 재개 기대" },
      { name: "TIGER 조선TOP10", type: "ETF", reason: "조선 빅3 비중 집중" },
    ],
  },
  {
    key: "energy",
    label: "에너지",
    icon: <Factory className="size-4" />,
    why: "유가 상단 열림 → 정유·E&P 마진 확대 구간",
    assets: [
      { name: "S-Oil", type: "주식", reason: "정제마진 스프레드 확대" },
      { name: "TIGER 원유선물", type: "ETF", reason: "유가 직접 연동" },
    ],
  },
];

const relatedFunds = [
  { name: "글로벌 해운·조선 펀드", type: "펀드", reason: "섹터 비중 35% 이상" },
  { name: "한국 인프라 ELS 12회차", type: "ELS", reason: "HMM·현대중공업 기초자산" },
];

export function HormuzOpportunityDialog({ open, onOpenChange }: Props) {
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
                  호르무즈 해협 긴장 고조,<br />조선·해운이 다시 뜬다
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

            {/* WHY NOW - 그래픽 카드 */}
            <section className="space-y-3">
              <SectionTitle icon="⚡">지금 왜 주목해야 할까요?</SectionTitle>
              <div className="rounded-2xl bg-[color:var(--neg-soft)]/40 border border-[color:var(--neg)]/20">
              <div className="rounded-[14px] p-5 space-y-3">
                <p className="text-[15px] font-bold text-foreground leading-snug">
                  중동 지정학 리스크가 글로벌 원유 수송 경로를 흔들고 있어요.
                </p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  호르무즈 해협은 전 세계 원유의 약 <span className="font-semibold text-foreground">20%</span>가 지나는 길목이에요.
                  통항 차질 우려가 커지면서 <span className="font-semibold text-foreground">우회 항로 → 톤마일 증가 → 운임 급등</span>으로 이어지고 있어요.
                </p>

                {/* 미니 흐름도 */}
                <div className="flex items-center justify-between gap-1.5 pt-2">
                  {[
                    { k: "긴장 고조", v: "🛢️" },
                    { k: "운임 ↑", v: "🚢" },
                    { k: "수주 ↑", v: "⚓" },
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

                {/* 미니 운임 그래프 */}
                <div className="rounded-xl bg-card border border-border/60 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12.5px] font-semibold text-foreground">원유 운송 가격 (일주일 집계)</span>
                    <span className="text-[16px] font-bold text-[color:var(--pos)]">+28.4%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">단위: 천 달러/일 · VLCC 일일 운임</p>
                  <div className="flex gap-1.5">
                    <div className="flex flex-col justify-between text-[9px] text-muted-foreground py-0.5 shrink-0">
                      <span>50</span>
                      <span>40</span>
                      <span>30</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="w-full h-32">
                        <g className="text-[color:var(--pos)]">
                          <path
                            d="M0,80 L33,72 L66,62 L99,48 L132,36 L165,20 L200,6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                          {[
                            [0, 80], [33, 72], [66, 62], [99, 48], [132, 36], [165, 20], [200, 6],
                          ].map(([x, y]) => (
                            <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" fill="currentColor" />
                          ))}
                        </g>
                      </svg>
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                        {["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "오늘"].map((d) => (
                          <span key={d}>{d}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>


              </div>
              </div>
            </section>

            {/* 투자 인사이트 */}
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

            {/* 수혜 섹터 요약 */}
            <section className="space-y-3">
              <SectionTitle icon="🎯">어떤 종목이 움직일까요?</SectionTitle>
              <p className="text-[12.5px] text-muted-foreground leading-relaxed px-1 -mt-1">
                호르무즈 이벤트와 직간접적으로 연결된 섹터의 대표 자산을 모았어요.
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

            {/* 영향 받는 금융상품 */}
            <section className="space-y-3">
              <SectionTitle icon="🔗">함께 보면 좋은 금융상품</SectionTitle>
              <ul className="space-y-2">{relatedFunds.map(renderAsset)}</ul>
            </section>

            {/* 리스크 */}
            <section className="space-y-2">
              <SectionTitle icon="⚠️">투자 전 꼭 확인하세요</SectionTitle>
              <div className="rounded-xl bg-[color:var(--neg-soft)]/40 border border-[color:var(--neg)]/20 px-4 py-3 space-y-1.5">
                <p className="text-[12.5px] text-foreground/90 leading-relaxed">
                  • 외교적 합의로 긴장이 빠르게 해소되면 운임·유가가 단기 급락할 수 있어요.
                </p>
                <p className="text-[12.5px] text-foreground/90 leading-relaxed">
                  • 이미 주가에 상당 부분 선반영된 종목은 추격 매수를 피하는 것이 좋아요.
                </p>
              </div>
            </section>
          </div>

        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
