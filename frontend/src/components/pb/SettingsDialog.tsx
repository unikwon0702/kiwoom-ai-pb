import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer";
import { Drawer as DrawerPrimitive } from "vaul";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Star, Plus, X, Settings as SettingsIcon, Info, Trash2, Minus } from "lucide-react";
import { useState, useEffect } from "react";
import { useCustomer } from "@/lib/customer-context";
import { api } from "@/lib/api";

type Item = { category: string; name: string };

function mapAssetType(assetType: string): string {
  switch (assetType) {
    case "해외주식":
    case "국내주식":
      return "주식";
    case "ETF":
      return "ETF";
    case "펀드":
      return "펀드";
    case "채권":
      return "채권";
    default:
      return assetType;
  }
}

function categoryBadgeClass(category: string) {
  switch (category) {
    case "주식":
      return "bg-[oklch(0.95_0.03_255)] text-[oklch(0.45_0.15_255)]";
    case "ETF":
      return "bg-[oklch(0.95_0.04_180)] text-[oklch(0.42_0.13_200)]";
    case "펀드":
      return "bg-[oklch(0.96_0.04_140)] text-[oklch(0.42_0.12_150)]";
    case "채권":
      return "bg-[oklch(0.95_0.02_290)] text-[oklch(0.42_0.13_290)]";
    default:
      return "bg-muted text-muted-foreground";
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SettingsDialog({ open, onOpenChange }: Props) {
  const { customer } = useCustomer();
  const [watchlist, setWatchlist] = useState<Item[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Item | null>(null);

  // 알림설정 - 종목 당일 시세 변동 설정 팝업
  const [openPriceChange, setOpenPriceChange] = useState(false);
  const [priceItems, setPriceItems] = useState<{ code: string; name: string; value: number }[]>([
    { code: "005930", name: "삼성전자", value: 0.8 },
  ]);

  // 고객 변경 또는 다이얼로그 열릴 때 관심종목 조회
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .getCustomerInterests(customer.id)
      .then((data) => {
        const items: Item[] = data.interests.map((i) => ({
          category: mapAssetType(i.asset_type),
          name: i.asset_name,
        }));
        setWatchlist(items);
        setAdded(new Set(items.map((i) => i.name)));
      })
      .catch(() => {
        setWatchlist([]);
        setAdded(new Set());
      })
      .finally(() => setLoading(false));
  }, [open, customer.id]);

  const confirmRemove = () => {
    if (!pendingRemove) return;
    setWatchlist((prev) => prev.filter((i) => i.name !== pendingRemove.name));
    setAdded((prev) => {
      const next = new Set(prev);
      next.delete(pendingRemove.name);
      return next;
    });
    setPendingRemove(null);
  };

  const toggleAdded = (item: Item) => {
    if (added.has(item.name)) {
      setPendingRemove(item);
    } else {
      setAdded((prev) => new Set(prev).add(item.name));
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerPortal>
          <DrawerOverlay />
          <DrawerPrimitive.Content className="fixed inset-0 z-50 flex h-full flex-col bg-background max-w-[480px] mx-auto focus:outline-none">
            <DrawerPrimitive.Title className="sr-only">설정</DrawerPrimitive.Title>

            <div className="flex-1 overflow-y-auto px-6 pt-[max(16px,env(safe-area-inset-top))] pb-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[18px] font-bold tracking-tight text-foreground">설정</h2>
                <button
                  onClick={() => onOpenChange(false)}
                  aria-label="닫기"
                  className="size-8 -mr-1 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60"
                >
                  <X className="size-4.5" />
                </button>
              </div>

              <Tabs defaultValue="watchlist" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="watchlist">관심종목설정</TabsTrigger>
                  <TabsTrigger value="notifications">알림설정</TabsTrigger>
                </TabsList>

                <TabsContent value="watchlist" className="space-y-2">
                  {loading && (
                    <p className="text-center text-[13px] text-muted-foreground py-8">
                      불러오는 중...
                    </p>
                  )}
                  {!loading && watchlist.length === 0 && (
                    <p className="text-center text-[13px] text-muted-foreground py-8">
                      관심종목이 없어요
                    </p>
                  )}
                  {!loading &&
                    watchlist.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between rounded-xl border border-border/60 px-3.5 py-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${categoryBadgeClass(item.category)}`}>
                            {item.category}
                          </span>
                          <span className="text-[14px] font-semibold text-foreground truncate">
                            {item.name}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleAdded(item)}
                          aria-label={added.has(item.name) ? "관심종목 제거" : "관심종목 추가"}
                          className={`shrink-0 flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                            added.has(item.name)
                              ? "bg-[color:var(--brand-sub)] text-white border-[color:var(--brand-sub)]"
                              : "bg-card text-foreground/80 border-border/60 hover:bg-muted/40"
                          }`}
                        >
                          {added.has(item.name) ? <Star className="size-3 fill-current" /> : <Plus className="size-3" />}
                          관심
                        </button>
                      </div>
                    ))}
                </TabsContent>

                <TabsContent value="notifications" className="space-y-2">
                  <NotificationsPanel onOpenPriceChange={() => setOpenPriceChange(true)} />
                </TabsContent>
              </Tabs>
            </div>
          </DrawerPrimitive.Content>
        </DrawerPortal>
      </Drawer>

      <AlertDialog open={!!pendingRemove} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[18px] font-bold">
              관심그룹에서 삭제하시겠습니까?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13.5px]">
              등록그룹 : 관심종목 1
              {pendingRemove && (
                <span className="block mt-1 text-foreground/80 font-medium">
                  {pendingRemove.category} · {pendingRemove.name}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
            <AlertDialogCancel className="flex-1 m-0">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="flex-1 bg-[oklch(0.25_0.08_265)] text-white hover:bg-[oklch(0.22_0.08_265)]"
            >
              종목 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PriceChangeDialog
        open={openPriceChange}
        onOpenChange={setOpenPriceChange}
        items={priceItems}
        setItems={setPriceItems}
      />
    </>
  );
}

/* ============ 알림설정 패널 ============ */

const CATEGORY_TABS = ["주식", "펀드", "채권", "파생결합증권"] as const;

type ToggleRow = { label: string; hasGear?: boolean; gearAction?: "price" };

const GROUP_SECTIONS: { title: string; rows: ToggleRow[] }[] = [
  {
    title: "가격 변동",
    rows: [
      { label: "종목 당일 시세 변동 설정", hasGear: true, gearAction: "price" },
      { label: "전일 대비 주가 변동 설정", hasGear: true },
      { label: "52주 신고가/신저가 알림 설정", hasGear: true },
      { label: "이동평균선 주가 추세 알림 설정", hasGear: true },
    ],
  },
  {
    title: "위험/손실",
    rows: [
      { label: "MDD 알림 설정", hasGear: true },
      { label: "샤프비율 알림 설정", hasGear: true },
    ],
  },
];

const IMPORTANCE_SECTIONS: { title: string; rows: ToggleRow[] }[] = [
  {
    title: "핵심 케어",
    rows: [
      { label: "가격 변동" },
      { label: "위험/손실" },
      { label: "시장 경보" },
      { label: "실적/펀더멘털" },
      { label: "신용/재무안정성" },
    ],
  },
  {
    title: "기본 케어",
    rows: [{ label: "수급/거래량" }],
  },
];

function NotificationsPanel({ onOpenPriceChange }: { onOpenPriceChange: () => void }) {
  const [mode, setMode] = useState<"group" | "importance">("group");
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORY_TABS)[number]>("주식");
  const [enabled, setEnabled] = useState<Record<string, Set<string>>>({
    "주식": new Set(),
    "펀드": new Set(),
    "채권": new Set(),
    "파생결합증권": new Set(),
  });

  // 현재 모드의 모든 라벨 목록
  const currentLabels = (mode === "group" ? GROUP_SECTIONS : IMPORTANCE_SECTIONS)
    .flatMap((s) => s.rows.map((r) => r.label));

  const currentSet = enabled[activeCategory] ?? new Set<string>();
  const allOn = currentLabels.length > 0 && currentLabels.every((l) => currentSet.has(l));

  const toggleAll = (on: boolean) => {
    setEnabled((prev) => {
      const next = { ...prev };
      const catSet = new Set(prev[activeCategory]);
      if (on) {
        currentLabels.forEach((l) => catSet.add(l));
      } else {
        currentLabels.forEach((l) => catSet.delete(l));
      }
      next[activeCategory] = catSet;
      return next;
    });
  };

  const toggleOne = (label: string, on: boolean) => {
    setEnabled((prev) => {
      const next = { ...prev };
      const catSet = new Set(prev[activeCategory]);
      if (on) catSet.add(label);
      else catSet.delete(label);
      next[activeCategory] = catSet;
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-lg bg-muted/60 p-1">
        {(["group", "importance"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-[13px] font-semibold py-1.5 rounded-md transition-colors ${
              mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {m === "group" ? "알림군별" : "중요도별"}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {CATEGORY_TABS.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`text-[12.5px] font-semibold whitespace-nowrap px-3 py-1.5 rounded-full border transition-colors ${
              activeCategory === c
                ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]"
                : "bg-card text-foreground/80 border-border/60"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 px-1">
        <span className="text-[12.5px] text-muted-foreground">전체선택</span>
        <Switch checked={allOn} onCheckedChange={toggleAll} />
      </div>

      <div className="space-y-4">
        {(mode === "group" ? GROUP_SECTIONS : IMPORTANCE_SECTIONS).map((section) => (
          <div key={section.title}>
            <div className="text-[12.5px] font-semibold text-muted-foreground mb-1.5 px-1">
              {section.title}
            </div>
            <div className="divide-y divide-border/60 border border-border/60 rounded-xl overflow-hidden bg-card">
              {section.rows.map((row) => (
                <NotifyRow
                  key={row.label}
                  label={row.label}
                  checked={currentSet.has(row.label)}
                  onCheckedChange={(on) => toggleOne(row.label, on)}
                  hasGear={row.hasGear}
                  onGearClick={row.gearAction === "price" ? onOpenPriceChange : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryPillTabs() {
  const [active, setActive] = useState<(typeof CATEGORY_TABS)[number]>("주식");
  return (
    <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
      {CATEGORY_TABS.map((c) => (
        <button
          key={c}
          onClick={() => setActive(c)}
          className={`shrink-0 text-[12.5px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            active === c
              ? "bg-[oklch(0.25_0.08_265)] text-white border-[oklch(0.25_0.08_265)]"
              : "bg-card text-foreground/70 border-border/60"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function NotifyRow({
  label,
  checked,
  onCheckedChange,
  hasGear,
  onGearClick,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
  hasGear?: boolean;
  onGearClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-3.5 py-3">
      <span className="text-[13.5px] text-foreground/90">{label}</span>
      <div className="flex items-center gap-3 shrink-0">
        {hasGear && (
          <button
            onClick={onGearClick}
            aria-label="설정"
            className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60"
          >
            <SettingsIcon className="size-4" />
          </button>
        )}
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}

/* ============ 종목 당일 시세 변동 설정 ============ */

function PriceChangeDialog({
  open,
  onOpenChange,
  items,
  setItems,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: { code: string; name: string; value: number }[];
  setItems: React.Dispatch<React.SetStateAction<{ code: string; name: string; value: number }[]>>;
}) {
  const update = (idx: number, delta: number) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, value: Math.max(0, Math.round((it.value + delta) * 10) / 10) } : it,
      ),
    );
  };
  const remove = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content className="fixed inset-0 z-[60] flex h-full flex-col bg-background max-w-[480px] mx-auto focus:outline-none">
          <DrawerPrimitive.Title className="sr-only">종목 당일 시세 변동 설정</DrawerPrimitive.Title>

          <div className="relative flex items-center justify-center pt-[max(14px,env(safe-area-inset-top))] pb-3 border-b border-border/60">
            <h3 className="text-[15px] font-bold">종목 당일 시세 변동 설정</h3>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13.5px] font-bold text-foreground">종목 설정</div>
              <button className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <Info className="size-3.5" /> 이용안내
              </button>
            </div>

            <div className="space-y-2 mb-5">
              {items.map((it, i) => (
                <div key={it.code} className="flex items-center gap-2 py-2">
                  <span className="text-[12.5px] text-muted-foreground tabular-nums">{it.code}</span>
                  <span className="text-[14px] font-bold text-foreground flex-1 truncate">
                    {it.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => update(i, -0.1)}
                      className="size-6 rounded-md border border-border/70 flex items-center justify-center"
                      aria-label="감소"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="text-[14px] font-semibold tabular-nums min-w-[28px] text-center">
                      {it.value.toFixed(1)}
                    </span>
                    <button
                      onClick={() => update(i, 0.1)}
                      className="size-6 rounded-md border border-border/70 flex items-center justify-center"
                      aria-label="증가"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => remove(i)}
                    aria-label="삭제"
                    className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/60"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() =>
                setItems((prev) => [...prev, { code: "000000", name: "새 종목", value: 1.0 }])
              }
              className="w-full border border-dashed border-border rounded-xl py-3 text-[13.5px] text-foreground/80 hover:bg-muted/40"
            >
              + 종목 추가
            </button>
          </div>

          <div className="grid grid-cols-2 border-t border-border/60">
            <button
              onClick={() => onOpenChange(false)}
              className="py-4 text-[14.5px] font-semibold text-foreground/80 bg-muted/40"
            >
              취소
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="py-4 text-[14.5px] font-semibold text-white bg-[oklch(0.25_0.08_265)]"
            >
              저장
            </button>
          </div>
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
