import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer";
import { Drawer as DrawerPrimitive } from "vaul";
import { X, TrendingUp, TrendingDown, Minus, ChevronDown, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { tagClassName } from "@/components/pb/tag-style";
import { api } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AiChatCta } from "./AiChatCta";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; eventId: string | null };

type ImpactedAsset = {
  asset_id: string; asset_name: string; asset_type: string; sector: string;
  relation_type: string; impact_direction: string; impact_score: number;
  reason: string; short_reason: string; similar_past_case?: string; market_reaction?: string;
};

function SectionTitle({ icon, children }: { icon?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </div>
  );
}

function ImpactIcon({ direction }: { direction: string }) {
  if (direction === "긍정") return <TrendingUp className="size-4" />;
  if (direction === "부정") return <TrendingDown className="size-4" />;
  return <Minus className="size-4" />;
}

function impactColor(direction: string) {
  if (direction === "긍정") return "bg-[color:var(--pos-soft)] text-[color:var(--pos)]";
  if (direction === "부정") return "bg-[color:var(--neg-soft)] text-[color:var(--neg)]";
  return "bg-muted text-muted-foreground";
}

export function EventDetailDialog({ open, onOpenChange, eventId }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeSector, setActiveSector] = useState(0);
  const [showIndirect, setShowIndirect] = useState(false);

  useEffect(() => {
    if (!open || !eventId) return;
    setLoading(true);
    setActiveSector(0);
    api.getEventDetail(eventId)
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, eventId]);

  const tags: string[] = data?.tags_json ? JSON.parse(data.tags_json) : [];
  const allAssets: ImpactedAsset[] = data?.impacted_assets_json ? JSON.parse(data.impacted_assets_json) : [];
  const chartData: { label: string; value: number; count: number }[] = data?.chart_data ?? [];

  // Enriched content 파싱
  let enriched: any = {};
  if (data?.enriched_sections) {
    try {
      enriched = typeof data.enriched_sections === 'string' ? JSON.parse(data.enriched_sections) : data.enriched_sections;
    } catch {}
  }
  const causalFlow: string[] = enriched.causal_flow ?? [];
  const causalFlowEmojis = causalFlow.map((step, idx) => {
    if (/AI|인공지능|LLM/i.test(step)) return "🤖";
    if (/반도체|메모리|DRAM|NAND|HBM|칩/i.test(step)) return "🧠";
    if (/장비|소재|공장|생산|제조/i.test(step)) return "🏭";
    if (/금리|달러|원화|환율/i.test(step)) return "💵";
    if (/수출|무역|관세/i.test(step)) return "🌐";
    if (/배터리|전기차|EV|이차전지/i.test(step)) return "🔋";
    if (/바이오|제약|신약/i.test(step)) return "💊";
    if (/에너지|유가|석유/i.test(step)) return "⛽";
    if (/금융|은행|보험/i.test(step)) return "🏦";
    return ["🔍", "⚡", "💰", "📊", "🎯"][idx % 5];
  });
  const enrichedInsights: {tag: string; body: string}[] = enriched.insights ?? [];
  const enrichedRisks: string[] = enriched.risks ?? [];
  const shortReasonsMap: Record<string, string> = enriched.short_reasons ?? {};

  // 섹터별 그룹핑 (직접 영향만)
  const directAssets = allAssets.filter((a) => a.relation_type === "직접");
  const indirectAssets = allAssets.filter((a) => a.relation_type === "간접");
  const sectorGroups = directAssets.reduce<Record<string, ImpactedAsset[]>>((acc, a) => {
    const key = a.sector || "기타";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});
  const sectorKeys = Object.keys(sectorGroups);
  const currentAssets = sectorGroups[sectorKeys[activeSector]] ?? [];

  // 인사이트 (unique similar_past_case)
  const insights = Array.from(new Set(allAssets.map((a) => a.similar_past_case).filter(Boolean))).slice(0, 3);
  // 시장 반응 요약
  const reactions = Array.from(new Set(allAssets.map((a) => a.market_reaction).filter(Boolean))).slice(0, 2);

  // 감성 점수 기반 미니 차트 데이터 (시뮬레이션)
  const sentiment = parseFloat(data?.sentiment_score) || 0;
  const importance = parseFloat(data?.importance_score) || 0;

  const renderAsset = (a: ImpactedAsset) => (
    <li key={a.asset_id} className="flex items-center gap-3 rounded-xl border border-border/60 px-3.5 py-3">
      <span className={`size-8 rounded-full flex items-center justify-center shrink-0 ${impactColor(a.impact_direction)}`}>
        <ImpactIcon direction={a.impact_direction} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13.5px] font-semibold text-foreground truncate">{a.asset_name}</span>
          <span className="text-[10.5px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60 shrink-0">{a.asset_type}</span>
        </div>
        <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{a.short_reason || shortReasonsMap[a.asset_name] || a.reason}</p>
      </div>
    </li>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[24px] border bg-background max-w-[480px] mx-auto focus:outline-none">
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 rounded-full bg-muted" />
          <DrawerPrimitive.Title className="sr-only">이벤트 상세</DrawerPrimitive.Title>

          <div className="px-6 pt-4 pb-3 space-y-7 max-h-[78vh] overflow-y-auto">
            {loading ? (
              <div className="space-y-4 py-8">
                <div className="h-6 w-48 rounded bg-muted animate-pulse" />
                <div className="h-4 w-full rounded bg-muted animate-pulse" />
                <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
              </div>
            ) : data ? (
              <>
                {/* 헤더 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {enriched.tag && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${tagClassName("호재")}`}>{enriched.tag}</span>
                      )}
                      {tags.slice(0, enriched.tag ? 1 : 2).map((t) => (
                        <span key={t} className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${tagClassName("호재")}`}>{t}</span>
                      ))}
                    </div>
                    <h2 className="text-[19px] font-bold tracking-tight text-foreground leading-snug">
                      {enriched.headline_question ?? data.event_title}
                    </h2>
                  </div>
                  <button onClick={() => onOpenChange(false)} aria-label="닫기"
                    className="size-8 -mr-1 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors">
                    <X className="size-4.5" />
                  </button>
                </div>

                {/* WHY NOW 카드 + 차트 */}
                <section className="space-y-3">
                  <SectionTitle icon="⚡">지금 왜 주목해야 할까요?</SectionTitle>
                  <div className="rounded-2xl bg-[color:var(--neg-soft)]/40 border border-[color:var(--neg)]/20">
                    <div className="rounded-[14px] p-5 space-y-3">
                      <p className="text-[15px] font-bold text-foreground leading-snug">
                        {data.ai_investment_view}
                      </p>
                      {(enriched.detail || data.event_summary) && (
                        <p className="text-[13px] text-muted-foreground leading-relaxed">
                          {enriched.detail ?? data.event_summary}
                        </p>
                      )}

                      {/* 인과관계 흐름도 */}
                      {causalFlow.length > 0 && (
                        <div className="flex items-center justify-between gap-1.5 pt-2">
                          {causalFlow.map((step, i) => (
                            <div key={i} className="flex items-center gap-1.5 flex-1">
                              <div className="flex-1 flex flex-col items-center gap-1 rounded-xl bg-card border border-border/60 py-2.5 px-1">
                                <span className="text-[18px]">{causalFlowEmojis[i]}</span>
                                <span className="text-[11px] font-semibold text-foreground text-center leading-tight">{step}</span>
                              </div>
                              {i < causalFlow.length - 1 && (
                                <span className="text-muted-foreground text-[14px]">→</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 신호 강도 추이 / 섹터별 영향도 */}
                      {chartData.length > 0 ? (
                        <div className="rounded-xl bg-card border border-border/60 p-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12.5px] font-semibold text-foreground">신호 강도 추이</span>
                            <span className="text-[11px] text-muted-foreground">{data.related_sector} · 최근 8주</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mb-2">주별 뉴스 중요도 평균 (높을수록 주목도 상승)</p>
                          <ResponsiveContainer width="100%" height={80}>
                            <AreaChart data={chartData} margin={{ top: 4, right: 2, left: -28, bottom: 0 }}>
                              <defs>
                                <linearGradient id={`grad-${data.event_id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="var(--pos)" stopOpacity={0.35} />
                                  <stop offset="95%" stopColor="var(--pos)" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis
                                dataKey="label"
                                tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Area
                                type="monotone"
                                dataKey="value"
                                stroke="var(--pos)"
                                strokeWidth={2}
                                fill={`url(#grad-${data.event_id})`}
                                dot={false}
                                activeDot={{ r: 3, fill: "var(--pos)", strokeWidth: 0 }}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: "var(--background)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  padding: "4px 8px",
                                }}
                                formatter={(v: any) => [`${v}`, "신호강도"]}
                                labelFormatter={(l) => `${l}주`}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-card border border-border/60 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[12.5px] font-semibold text-foreground">섹터별 영향도</span>
                            <span className="text-[11px] text-muted-foreground">{allAssets.length}개 종목 분석</span>
                          </div>
                          <div className="space-y-2">
                            {sectorKeys.slice(0, 4).map((sector) => {
                              const assets = sectorGroups[sector] ?? [];
                              const avgScore = assets.reduce((sum, a) => sum + (a.impact_score || 0), 0) / assets.length;
                              const pct = Math.min(Math.round(avgScore * 100), 100);
                              const isPositive = assets.filter(a => a.impact_direction === "긍정").length >= assets.length / 2;
                              return (
                                <div key={sector}>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[11.5px] font-medium text-foreground">{sector}</span>
                                    <span className={`text-[11px] font-bold ${isPositive ? "text-[color:var(--pos)]" : "text-[color:var(--neg)]"}`}>
                                      {isPositive ? "+" : "-"}{pct}%
                                    </span>
                                  </div>
                                  <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${isPositive ? "bg-[color:var(--pos)]" : "bg-[color:var(--neg)]"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* 투자 인사이트 (enriched 우선) */}
                {(enrichedInsights.length > 0 || insights.length > 0) && (
                  <section className="space-y-3">
                    <SectionTitle icon="💡">이런 흐름이 보여요</SectionTitle>
                    <ul className="space-y-2">
                      {enrichedInsights.length > 0
                        ? enrichedInsights.map((ins, i) => (
                            <li key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3">
                              <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md bg-[color:var(--brand-sub)] text-white">
                                {ins.tag}
                              </span>
                              <p className="text-[13px] text-foreground/90 leading-relaxed">{ins.body}</p>
                            </li>
                          ))
                        : insights.map((ins, i) => (
                            <li key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3">
                              <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md bg-[color:var(--brand-sub)] text-white">
                                {tags[i] || "인사이트"}
                              </span>
                              <p className="text-[13px] text-foreground/90 leading-relaxed">{ins}</p>
                            </li>
                          ))}
                    </ul>
                  </section>
                )}

                {/* 수혜 섹터 종목 */}
                {sectorKeys.length > 0 && (
                  <section className="space-y-3">
                    <SectionTitle icon="🎯">어떤 종목이 움직일까요?</SectionTitle>
                    <p className="text-[12.5px] text-muted-foreground leading-relaxed px-1 -mt-1">
                      이 이벤트와 직접적으로 연결된 섹터의 대표 자산을 모았어요.
                    </p>

                    <div className="flex gap-2">
                      {sectorKeys.map((s, i) => (
                        <button
                          key={s}
                          onClick={() => setActiveSector(i)}
                          className={`flex-1 inline-flex items-center justify-center text-[12px] font-semibold px-2 py-2 rounded-full border transition-colors min-w-0 ${
                            i === activeSector
                              ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]"
                              : "bg-card text-foreground/80 border-border/60"
                          }`}
                        >
                          #{s}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5 px-1">
                      <p className="text-[13px] font-semibold text-foreground">왜 연관 있나요?</p>
                      <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                        {currentAssets[0]?.reason}
                      </p>
                    </div>

                    <ul className="space-y-2">{currentAssets.map(renderAsset)}</ul>
                  </section>
                )}

                {/* 간접 영향 금융상품 */}
                {indirectAssets.length > 0 && (
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
                      <ul className="space-y-2">{indirectAssets.slice(0, 5).map(renderAsset)}</ul>
                    )}
                  </section>
                )}

                {/* 리스크 (enriched 우선) */}
                {(enrichedRisks.length > 0 || reactions.length > 0) && (
                  <section className="space-y-2">
                    <SectionTitle icon="⚠️">투자 전 꼭 확인하세요</SectionTitle>
                    <div className="rounded-xl bg-[color:var(--neg-soft)]/40 border border-[color:var(--neg)]/20 px-4 py-3 space-y-1.5">
                      {(enrichedRisks.length > 0 ? enrichedRisks : reactions).map((r, i) => (
                        <p key={i} className="text-[12.5px] text-foreground/90 leading-relaxed">• {r}</p>
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <p className="text-center text-[13px] text-muted-foreground py-12">이벤트 정보를 불러올 수 없습니다.</p>
            )}
          </div>
          {data && !loading && (
            <AiChatCta onClick={() => { onOpenChange(false); navigate({ to: "/chat", search: {} }); }} />
          )}
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
