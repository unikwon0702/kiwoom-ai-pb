import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ProductHistoryDialog } from "@/components/pb/ProductHistoryDialog";

export const Route = createFileRoute("/product-history")({
  component: ProductHistoryPage,
});

type AssetType = "주식" | "ETF" | "펀드" | "ELS" | "ELB" | "채권";

type ProductRecord = {
  type: AssetType;
  name: string;
  days: number;
  count: number;
  latest: string;
  latestTime: string;
  trend: "up" | "down" | "flat";
};

const records: ProductRecord[] = [
  { type: "주식", name: "삼성전자", days: 7, count: 12, latest: "외국인 순매수 영향으로 +1.2% 상승", latestTime: "방금", trend: "up" },
  { type: "주식", name: "현대차", days: 7, count: 9, latest: "실적 개선 기대로 +1.8% 상승", latestTime: "12분 전", trend: "up" },
  { type: "ETF", name: "TIGER 미국S&P500", days: 7, count: 15, latest: "기술주 강세로 기준가 +1.1%", latestTime: "1시간 전", trend: "up" },
  { type: "ETF", name: "KODEX 2차전지", days: 7, count: 21, latest: "정책 자금 유입으로 +3.1% 상승", latestTime: "3시간 전", trend: "up" },
  { type: "펀드", name: "글로벌 인컴 펀드", days: 7, count: 8, latest: "배당 재투자 효과로 기준가 +0.4%", latestTime: "어제", trend: "up" },
  { type: "ELS", name: "삼성전자 ELS 12회차", days: 7, count: 11, latest: "기초자산 안정으로 조기상환 조건 근접", latestTime: "2일 전", trend: "up" },
  { type: "ELB", name: "코스피200 ELB", days: 7, count: 10, latest: "지수 반등으로 평가금액 +0.8%", latestTime: "4일 전", trend: "up" },
  { type: "채권", name: "국고채 10년물", days: 7, count: 14, latest: "금리 하락 영향으로 채권 가격 +0.6%", latestTime: "6일 전", trend: "up" },
  { type: "채권", name: "회사채 AA- 3년물", days: 7, count: 8, latest: "신용 스프레드 축소로 평가이익 +0.3%", latestTime: "10일 전", trend: "up" },
];

type FilterKey = "전체" | "주식·ETF" | "펀드·채권·파생상품";
const filters: FilterKey[] = ["전체", "주식·ETF", "펀드·채권·파생상품"];
const filterMap: Record<FilterKey, AssetType[] | null> = {
  "전체": null,
  "주식·ETF": ["주식", "ETF"],
  "펀드·채권·파생상품": ["펀드", "채권", "ELS", "ELB"],
};

function typeBadgeClass(type: AssetType) {
  switch (type) {
    case "주식":
      return "bg-[oklch(0.95_0.03_255)] text-[oklch(0.45_0.15_255)]";
    case "ETF":
      return "bg-[oklch(0.95_0.04_180)] text-[oklch(0.42_0.13_200)]";
    case "펀드":
      return "bg-[oklch(0.96_0.04_140)] text-[oklch(0.42_0.12_150)]";
    case "ELS":
      return "bg-[oklch(0.96_0.05_75)] text-[oklch(0.48_0.13_70)]";
    case "ELB":
      return "bg-[oklch(0.95_0.04_25)] text-[oklch(0.5_0.18_25)]";
    case "채권":
      return "bg-[oklch(0.95_0.02_290)] text-[oklch(0.42_0.13_290)]";
  }
}

function ProductHistoryPage() {
  const [active, setActive] = useState<FilterKey>("전체");
  const [openName, setOpenName] = useState<string | null>(null);
  const allowed = filterMap[active];
  const filtered = allowed === null ? records : records.filter(r => allowed.includes(r.type));

  return (
    <div className="min-h-screen bg-surface-muted">
      <div className="max-w-[480px] mx-auto bg-surface-muted">
        <header className="sticky top-0 z-10 bg-surface-muted/85 backdrop-blur-md">
          <div className="flex items-center px-2 h-14">
            <Link
              to="/notifications"
              className="size-9 flex items-center justify-center rounded-full hover:bg-muted text-foreground/70"
            >
              <ChevronLeft className="size-5" />
            </Link>
          </div>
        </header>

        <div className="px-5 pt-2 pb-5">
          <h1 className="text-[20px] font-bold tracking-tight text-foreground">내 자산 알림 모아보기</h1>
          <p className="text-[13px] text-muted-foreground mt-1">보유 중인 상품의 변화 기록을 확인해보세요</p>
        </div>

        <div className="px-5">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
            {filters.map(f => {
              const isActive = f === active;
              return (
                <button
                  key={f}
                  onClick={() => setActive(f)}
                  className={`shrink-0 text-[13px] font-medium px-3.5 py-2 rounded-full border transition-colors ${
                    isActive
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground border-border/70 hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        <main className="px-5 pt-4 pb-10">
          <ul className="space-y-2">
            {filtered.map((r, idx) => (
              <li key={`${r.name}-${idx}`}>
                <button
                  onClick={() => r.name === "삼성전자" && setOpenName(r.name)}
                  className="relative w-full text-left pl-4 pr-9 py-3.5 rounded-2xl bg-card border border-border/60 transition-colors hover:bg-muted/40"
                >
                  <span className="absolute right-3 top-3 text-[11.5px] text-muted-foreground/70">{r.latestTime}</span>
                  <div className="flex items-center gap-2 pr-14">
                    <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${typeBadgeClass(r.type)}`}>
                      {r.type}
                    </span>
                    <span className="flex-1 text-[14px] font-bold text-foreground truncate">{r.name}</span>
                  </div>
                  <div className="mt-1.5 text-[11.5px] text-muted-foreground/80">
                    최근 변화 {r.count}건
                  </div>
                  <div className="mt-2 text-[12.5px] text-foreground/80 truncate">{r.latest}</div>
                  <ChevronRight className="size-4 text-muted-foreground/60 absolute right-3 top-1/2 -translate-y-1/2" />
                </button>
              </li>
            ))}
          </ul>
        </main>
        <ProductHistoryDialog
          open={openName === "삼성전자"}
          onOpenChange={(o) => !o && setOpenName(null)}
          tag="주식"
          title="삼성전자"
        />
      </div>
    </div>
  );
}
