import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { tagClassName } from "@/components/pb/tag-style";

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

export type EventDetailContentProps = {
  data: any;
  inChat?: boolean;
  onClose?: () => void;
};

export function EventDetailContent({ data, inChat = false, onClose }: EventDetailContentProps) {
  if (!data) return null;

  const tags: string[] = data?.tags_json ? JSON.parse(data.tags_json) : [];
  const allAssets: ImpactedAsset[] = data?.impacted_assets_json ? JSON.parse(data.impacted_assets_json) : [];

  let enriched: any = {};
  if (data?.enriched_sections) {
    try {
      enriched = typeof data.enriched_sections === "string" ? JSON.parse(data.enriched_sections) : data.enriched_sections;
    } catch {}
  }
  const causalFlow: string[] = enriched.causal_flow ?? [];
  const enrichedInsights: { tag: string; body: string }[] = enriched.insights ?? [];
  const shortReasonsMap: Record<string, string> = enriched.short_reasons ?? {};

  const directAssets = allAssets.filter((a) => a.relation_type === "직접");
  const sectorGroups = directAssets.reduce<Record<string, ImpactedAsset[]>>((acc, a) => {
    const key = a.sector || "기타";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});
  const sectorKeys = Object.keys(sectorGroups);

  const insights = Array.from(new Set(allAssets.map((a) => a.similar_past_case).filter(Boolean))).slice(0, 3);

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
    <div className={inChat ? "space-y-7" : "px-6 pt-4 pb-3 space-y-7 max-h-[78vh] overflow-y-auto"}>
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
        {!inChat && onClose && (
          <button onClick={onClose} aria-label="닫기"
            className="size-8 -mr-1 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors">
            <X className="size-4.5" />
          </button>
        )}
      </div>

      {/* WHY NOW */}
      <section className="space-y-3">
        <SectionTitle icon="⚡">지금 왜 주목해야 할까요?</SectionTitle>
        <div className="rounded-2xl bg-[color:var(--neg-soft)]/40 border border-[color:var(--neg)]/20">
          <div className="rounded-[14px] p-5 space-y-3">
            <p className="text-[15px] font-bold text-foreground leading-snug">{data.ai_investment_view}</p>
            {(enriched.detail || data.event_summary) && (
              <p className="text-[13px] text-muted-foreground leading-relaxed">{enriched.detail ?? data.event_summary}</p>
            )}
            {causalFlow.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 py-2">
                {causalFlow.map((step, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="text-[12px] font-medium text-foreground bg-muted/80 px-2 py-1 rounded-lg">{step}</span>
                    {i < causalFlow.length - 1 && <span className="text-muted-foreground text-[14px]">→</span>}
                  </span>
                ))}
              </div>
            )}
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
                  const isPositive = assets.filter((a) => a.impact_direction === "긍정").length >= assets.length / 2;
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
          </div>
        </div>
      </section>

      {/* 투자 인사이트 */}
      {(enrichedInsights.length > 0 || insights.length > 0) && (
        <section className="space-y-3">
          <SectionTitle icon="💡">이런 흐름이 보여요</SectionTitle>
          <ul className="space-y-2">
            {enrichedInsights.length > 0
              ? enrichedInsights.map((ins, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3">
                    <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md bg-[color:var(--brand-sub)] text-white">{ins.tag}</span>
                    <p className="text-[13px] text-foreground/90 leading-relaxed">{ins.body}</p>
                  </li>
                ))
              : insights.map((ins, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3">
                    <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md bg-[color:var(--brand-sub)] text-white">{tags[i] || "인사이트"}</span>
                    <p className="text-[13px] text-foreground/90 leading-relaxed">{String(ins)}</p>
                  </li>
                ))}
          </ul>
        </section>
      )}

      {/* 영향 종목 */}
      {sectorKeys.length > 0 && (
        <section className="space-y-3">
          <SectionTitle icon="🧭">어떤 종목이 영향을 받을까요?</SectionTitle>
          {sectorKeys.slice(0, 3).map((sector) => (
            <div key={sector}>
              <p className="text-[12px] font-semibold text-foreground/70 mb-1.5">{sector}</p>
              <ul className="space-y-2">
                {(sectorGroups[sector] ?? []).slice(0, 4).map(renderAsset)}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
