import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ProductHistoryDialog } from "@/components/pb/ProductHistoryDialog";
import { useHoldingSignals } from "@/hooks/useApiData";
import { useCustomer } from "@/lib/customer-context";
import { getDisplayTime } from "@/lib/date";

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

type FilterKey = "전체" | "주식·ETF" | "펀드·채권·파생상품";
const filters: FilterKey[] = ["전체", "주식·ETF", "펀드·채권·파생상품"];
const filterMap: Record<FilterKey, AssetType[] | null> = {
  "전체": null,
  "주식·ETF": ["주식", "ETF"],
  "펀드·채권·파생상품": ["펀드", "채권", "ELS", "ELB"],
};

function inferAssetType(category: string | null | undefined, name: string): AssetType {
  if (!category && !name) return "주식";
  const n = (name ?? "").toLowerCase();
  if (n.includes("etf") || n.includes("tiger") || n.includes("kodex") || n.includes("arirang")) return "ETF";
  if (n.includes("펀드") || n.includes("투자신탁") || n.includes("trust")) return "펀드";
  if (n.includes("els")) return "ELS";
  if (n.includes("elb")) return "ELB";
  if (n.includes("채권") || n.includes("국고채") || n.includes("회사채") || n.includes("dlb") || n.includes("금리")) return "채권";
  return "주식";
}

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

  const { customer } = useCustomer();
  const { data: holdingsRaw, loading } = useHoldingSignals(customer.id, 50);

  // Group by asset_name and build ProductRecord[]
  const records: ProductRecord[] = (() => {
    const holdings = holdingsRaw?.holdings ?? [];
    if (holdings.length === 0) return [];

    const grouped: Record<string, any[]> = {};
    for (const h of holdings) {
      const name = h.asset_name ?? "";
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(h);
    }

    return Object.entries(grouped).map(([name, items], idx) => {
      const sorted = items.sort((a: any, b: any) => 
        (b.date ?? "").localeCompare(a.date ?? "")
      );
      const latest = sorted[0];
      return {
        type: inferAssetType(latest.signal_category, name),
        name,
        days: 7,
        count: items.length,
        latest: latest.signal_name ?? latest.interpretation ?? "",
        latestTime: getDisplayTime(latest.date, idx),
        trend: "up" as const,
      };
    });
  })();

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
          {loading ? (
            <div className="text-center py-12 text-[13px] text-muted-foreground">
              불러오는 중...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[13px] text-muted-foreground">
              표시할 자산 알림이 없습니다.
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((r, idx) => (
                <li key={`${r.name}-${idx}`}>
                  <button
                    onClick={() => setOpenName(r.name)}
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
          )}
        </main>
        <ProductHistoryDialog
          open={openName !== null}
          onOpenChange={(o) => !o && setOpenName(null)}
          tag={records.find(r => r.name === openName)?.type ?? "주식"}
          title={openName ?? ""}
        />
      </div>
    </div>
  );
}
