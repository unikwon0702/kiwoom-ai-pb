import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer";
import { Drawer as DrawerPrimitive } from "vaul";
import { useNavigate } from "@tanstack/react-router";
import { X, Plus, Star, Wallet, TrendingUp, TrendingDown, ChevronDown, Info } from "lucide-react";
import { AiChatCta } from "./AiChatCta";
import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  customerId?: string;
};

type Asset = {
  asset_name: string;
  asset_type: string;
  sector: string;
  relation_type: string;
  impact_direction: string;
  impact_score: number;
  short_reason: string;
  similar_past_case?: string;
  market_reaction?: string;
  holding?: string;
};

type SectorGroup = {
  label: string;
  impact: "positive" | "negative" | "neutral";
  assets: Asset[];
};

export function MarketEventDetailDialog({ open, onOpenChange, eventId, customerId = 'CUST0010' }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showIndirect, setShowIndirect] = useState(false);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !eventId) { setData(null); return; }
    setLoading(true);
    setActiveTab(0);
    setShowHistory(false);
    setShowIndirect(false);
    api.getEventDetail(eventId, customerId)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, eventId]);

  const goChat = () => { onOpenChange(false); navigate({ to: "/chat", search: {} }); };

  // impacted_assets_json 파싱
  let allAssets: Asset[] = [];
  try {
    allAssets = data?.impacted_assets_json ? (typeof data.impacted_assets_json === "string" ? JSON.parse(data.impacted_assets_json) : data.impacted_assets_json) : [];
  } catch { allAssets = []; }

  // Enriched content 파싱
  let enriched: any = {};
  if (data?.enriched_sections) {
    try {
      enriched = typeof data.enriched_sections === 'string' ? JSON.parse(data.enriched_sections) : data.enriched_sections;
    } catch {}
  }
  const enrichedOpinions: string[] = enriched.opinions ?? [];
  const causalFlow: string[] = enriched.causal_flow ?? [];
  const enrichedRisks: string[] = enriched.risks ?? [];
  const shortReasonsMap: Record<string, string> = enriched.short_reasons ?? {};

  // 직접 영향 → 섹터 그룹핑 (직접이 없으면 간접을 메인으로 승격)
  const rawDirect = allAssets.filter((a) => a.relation_type === "직접");
  const rawIndirect = allAssets.filter((a) => a.relation_type !== "직접");
  const directAssets = rawDirect.length > 0 ? rawDirect : rawIndirect;
  const indirectAssets = rawDirect.length > 0 ? rawIndirect : [];

  const sectorMap: Record<string, Asset[]> = {};
  directAssets.forEach((a) => {
    const s = a.sector || "기타";
    if (!sectorMap[s]) sectorMap[s] = [];
    sectorMap[s].push(a);
  });
  const sectorTabs: SectorGroup[] = Object.entries(sectorMap).map(([label, assets]) => {
    const positiveCount = assets.filter((a) => a.impact_direction === "긍정").length;
    const negativeCount = assets.filter((a) => a.impact_direction === "악재").length;
    const impact = negativeCount > positiveCount ? "negative" : positiveCount > 0 ? "positive" : "neutral";
    return { label, impact, assets };
  });

  const tab = sectorTabs[activeTab] ?? sectorTabs[0];

  // AI 의견: enriched 우선, fallback → ai_investment_view 문장 분리
  const aiView = data?.ai_investment_view || "";
  const opinions = enrichedOpinions.length > 0
    ? enrichedOpinions
    : aiView.split(/[.。]\s*/).filter((s: string) => s.trim().length > 5);

  // 히스토리 (similar_past_case에서 추출)
  const historyItems = allAssets
    .filter((a) => a.similar_past_case && a.similar_past_case.length > 10)
    .slice(0, 3)
    .map((a, i) => ({
      title: `${a.sector} 섹터 과거 사례`,
      detail: a.similar_past_case || "",
      reaction: a.market_reaction || "",
    }));

  // 감성 태그
  const sentiment = data?.sentiment_score ?? 0;
  const tag = sentiment > 0 ? "호재" : sentiment < 0 ? "악재" : "중립";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[24px] border bg-background max-w-[480px] mx-auto focus:outline-none"
        >
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 rounded-full bg-muted" />
          <DrawerPrimitive.Title className="sr-only">{data?.event_title ?? "이벤트"} 상세</DrawerPrimitive.Title>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="size-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                <span className="text-[13px] text-muted-foreground font-medium">분석 중...</span>
              </div>
            </div>
          ) : data ? (
            <div className="px-6 pt-4 pb-3 space-y-7 max-h-[78vh] overflow-y-auto">
              {/* 헤더 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    tag === "호재" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : tag === "악재" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-muted text-muted-foreground"
                  }`}>{tag}</span>
                  <h2 className="text-[18px] font-bold tracking-tight text-foreground">{data.event_title}</h2>
                </div>
                <button onClick={() => onOpenChange(false)} aria-label="닫기"
                  className="size-8 -mr-1 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors">
                  <X className="size-4.5" />
                </button>
              </div>

              {/* 📌 이벤트 요약 */}
              <section className="space-y-2">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
                  <span>📌</span><span>이벤트 요약</span>
                </div>
                <p className="text-[16px] font-bold text-foreground leading-snug">{data.ai_investment_view || data.event_title}</p>
                <p className="text-[13.5px] text-muted-foreground leading-relaxed">{data.event_summary || ""}</p>
              </section>

              {/* 인과 흐름도 */}
              {causalFlow.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
                    <span>🔄</span><span>핵심 흐름</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 py-2">
                    {causalFlow.map((step, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        <span className="text-[12px] font-medium text-foreground bg-muted/80 px-2.5 py-1.5 rounded-lg">{step}</span>
                        {i < causalFlow.length - 1 && <span className="text-muted-foreground text-[14px]">→</span>}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* 🤖 AI PB 의견 */}
              {opinions.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
                    <span>🤖</span><span>AI PB 의견</span>
                  </div>
                  <div className="rounded-2xl bg-muted/30 px-4 py-3.5">
                    <ul className="space-y-2 text-[14px] text-foreground/90 leading-relaxed">
                      {opinions.map((op: string, i: number) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-muted-foreground/60 mt-2 size-1.5 rounded-full bg-current shrink-0" />
                          <span>{op.trim()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {/* 🧭 섹터별 영향 종목 */}
              {sectorTabs.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
                    <span>🧭</span><span>어떤 자산이 영향을 받을까요?</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {sectorTabs.map((s, i) => {
                      const isActive = i === activeTab;
                      const positive = s.impact === "positive";
                      return (
                        <button key={s.label} onClick={() => setActiveTab(i)}
                          className={`inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                            isActive ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]"
                            : "bg-card text-foreground/80 border-border/60"
                          }`}>
                          <span>{s.label}</span>
                          <span className={`inline-flex items-center text-[11px] ${isActive ? "opacity-90" : positive ? "text-[color:var(--pos)]" : "text-[color:var(--neg)]"}`}>
                            {positive ? <TrendingUp className="size-3" /> : s.impact === "negative" ? <TrendingDown className="size-3" /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {tab && (
                    <>
                      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground/80 mt-1">
                        <span className="text-[color:var(--pos)]">💹</span>
                        <span>{tab.label} 관련 자산</span>
                      </div>
                      <ul className="space-y-2">
                        {tab.assets.map((a) => (
                          <li key={a.asset_name} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3">
                            <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
                              a.impact_direction === "긍정" ? "bg-[color:var(--pos)]/15" :
                              a.impact_direction === "악재" ? "bg-[color:var(--neg)]/15" : "bg-muted/60"
                            }`}>
                              {a.impact_direction === "긍정" ? <TrendingUp className="size-4 text-[color:var(--pos)]" /> :
                               a.impact_direction === "악재" ? <TrendingDown className="size-4 text-[color:var(--neg)]" /> :
                               <span className="text-[11px] font-bold text-muted-foreground">-</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[13.5px] font-semibold text-foreground truncate">{a.asset_name}</span>
                                <span className="text-[10.5px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{a.asset_type}</span>
                                {a.holding === "보유" && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[color:var(--brand)]/15 text-[color:var(--brand)]">
                                    <Wallet className="size-2.5" />보유
                                  </span>
                                )}
                                {a.holding === "관심" && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    <Star className="size-2.5 fill-current" />관심
                                  </span>
                                )}
                                {!a.holding && (
                                  <button
                                    onClick={() => setWatchlist(prev => { const s = new Set(prev); s.has(a.asset_name) ? s.delete(a.asset_name) : s.add(a.asset_name); return s; })}
                                    className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition-colors ${
                                      watchlist.has(a.asset_name) ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700" : "bg-muted/60 text-muted-foreground border-border/60"
                                    }`}>
                                    {watchlist.has(a.asset_name) ? <Star className="size-2.5 fill-current" /> : <Plus className="size-2.5" />}
                                    {watchlist.has(a.asset_name) ? "관심" : "관심 추가"}
                                  </button>
                                )}
                              </div>
                              <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{a.short_reason || shortReasonsMap[a.asset_name] || ""}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>
              )}

              {/* 🔗 간접 금융상품 */}
              {indirectAssets.length > 0 && (
                <section className="space-y-3">
                  <button onClick={() => setShowIndirect((v) => !v)}
                    className="w-full flex items-center justify-between text-[12px] font-semibold text-muted-foreground tracking-wide">
                    <span className="flex items-center gap-1.5">
                      <span>🔗</span><span>영향을 받을 수 있는 금융상품</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <span role="button" tabIndex={0} onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="설명">
                            <Info className="size-3.5" />
                          </span>
                        </PopoverTrigger>
                        <PopoverContent side="top" align="start" className="w-[240px] text-[12px] leading-relaxed" onClick={(e) => e.stopPropagation()}>
                          여러 자산에 투자되어 있어 기초자산을 통해 영향을 받을 수 있어요
                        </PopoverContent>
                      </Popover>
                    </span>
                    <ChevronDown className={`size-4 transition-transform ${showIndirect ? "rotate-180" : ""}`} />
                  </button>
                  {showIndirect && (
                    <ul className="space-y-2">
                      {indirectAssets.slice(0, 5).map((a) => (
                        <li key={a.asset_name} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3">
                          <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
                            a.impact_direction === "긍정" ? "bg-[color:var(--pos)]/15" :
                            a.impact_direction === "악재" ? "bg-[color:var(--neg)]/15" : "bg-muted/60"
                          }`}>
                            {a.impact_direction === "긍정" ? <TrendingUp className="size-4 text-[color:var(--pos)]" /> :
                             a.impact_direction === "악재" ? <TrendingDown className="size-4 text-[color:var(--neg)]" /> :
                             <span className="text-[11px] font-bold text-muted-foreground">-</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[13.5px] font-semibold text-foreground truncate">{a.asset_name}</span>
                              <span className="text-[10.5px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{a.asset_type}</span>
                              {a.holding === "보유" && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[color:var(--brand)]/15 text-[color:var(--brand)]">
                                  <Wallet className="size-2.5" />보유
                                </span>
                              )}
                              {a.holding === "관심" && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  <Star className="size-2.5 fill-current" />관심
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{a.short_reason || shortReasonsMap[a.asset_name] || ""}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {/* 🕘 유사 히스토리 */}
              {historyItems.length > 0 && (
                <section className="space-y-3">
                  <button onClick={() => setShowHistory((v) => !v)}
                    className="w-full flex items-center justify-between text-[12px] font-semibold text-muted-foreground tracking-wide">
                    <span className="flex items-center gap-1.5">
                      <span>🕘</span><span>비슷한 상황에서는 시장이 이렇게 움직였어요</span>
                    </span>
                    <ChevronDown className={`size-4 transition-transform ${showHistory ? "rotate-180" : ""}`} />
                  </button>
                  {showHistory && (
                    <ol className="relative space-y-3 pl-4 before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-px before:bg-border">
                      {historyItems.map((h, i) => (
                        <li key={i} className="relative">
                          <span className="absolute -left-[14px] top-1.5 size-2 rounded-full bg-foreground/70" />
                          <div className="text-[13.5px] font-semibold text-foreground mt-0.5 leading-snug">{h.title}</div>
                          <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-1">{h.detail}</p>
                          {h.reaction && <p className="text-[11.5px] text-muted-foreground/80 mt-0.5">{h.reaction}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              )}
              {/* ⚠️ 리스크 */}
              {enrichedRisks.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
                    <span>⚠️</span><span>투자 전 꼭 확인하세요</span>
                  </div>
                  <div className="rounded-xl bg-[color:var(--neg-soft)]/40 border border-[color:var(--neg)]/20 px-4 py-3 space-y-1.5">
                    {enrichedRisks.map((r, i) => (
                      <p key={i} className="text-[12.5px] text-foreground/90 leading-relaxed">• {r}</p>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-20">
              <span className="text-[13px] text-muted-foreground">이벤트 정보를 불러올 수 없어요.</span>
            </div>
          )}

          <AiChatCta onClick={goChat} />
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
