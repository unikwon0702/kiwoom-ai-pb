import { X } from "lucide-react";

export type NewsSignalDetailContentProps = {
  data: any;
  inChat?: boolean;
  onClose?: () => void;
};

function getCausalEmoji(step: string, idx: number): string {
  if (/AI|인공지능|LLM/i.test(step)) return "🤖";
  if (/반도체|메모리|DRAM|HBM|칩/i.test(step)) return "🧠";
  if (/장비|소재|공장|생산|제조/i.test(step)) return "🏭";
  if (/금리|달러|원화|환율/i.test(step)) return "💵";
  if (/수출|무역|관세/i.test(step)) return "🌐";
  if (/배터리|전기차|EV|이차전지/i.test(step)) return "🔋";
  if (/바이오|제약|신약/i.test(step)) return "💊";
  if (/에너지|유가|석유/i.test(step)) return "⛽";
  if (/금융|은행|보험/i.test(step)) return "🏦";
  return ["🔍", "⚡", "💰", "📊", "🎯"][idx % 5];
}

export function NewsSignalDetailContent({ data, inChat = false, onClose }: NewsSignalDetailContentProps) {
  if (!data) return null;

  const causalFlow: string[] = data.causal_flow ?? [];
  const enrichedInsights: { tag: string; body: string }[] = data.enriched_insights ?? [];
  const sectorImpacts: { sector: string; direction: string; impact_pct?: number }[] = data.sector_impacts ?? [];
  const hashtags: string[] = data.hashtags ?? [];
  const relatedAssets: { asset_name: string; asset_type?: string; reason?: string; holding?: boolean }[] = data.related_assets ?? [];
  const whyNotable: string[] = data.why_notable ?? [];
  const aiView: string = data.ai_investment_view ?? "";
  const detailText: string = data.detail_text ?? "";
  const enrichedTag: string = data.enriched_tag ?? "";

  const hasWhySection = aiView || detailText || causalFlow.length > 0 || sectorImpacts.length > 0 || whyNotable.length > 0;

  return (
    <div className={inChat ? "px-6 pt-4 pb-3 space-y-6" : "px-6 pt-4 pb-3 space-y-6 max-h-[78vh] overflow-y-auto"}>

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {enrichedTag ? (
              <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-foreground/85 text-background">
                {enrichedTag}
              </span>
            ) : (
              <span className="text-[11.5px] text-muted-foreground">의외의 신호</span>
            )}
          </div>
          <h2 className="text-[18px] font-bold text-foreground leading-snug">{data.title}</h2>
        </div>
        {!inChat && onClose && (
          <button onClick={onClose} aria-label="닫기"
            className="size-8 -mr-1 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* 지금 왔 주목해야 할까요? (홈 화면과 동일 구조) */}
      {hasWhySection && (
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
            <span>⚡</span><span>지금 왔 주목해야 할까요?</span>
          </div>
          <div className="rounded-2xl bg-[color:var(--neg-soft)]/40 border border-[color:var(--neg)]/20">
            <div className="rounded-[14px] p-5 space-y-3">

              {/* bold AI 요약 */}
              {aiView && (
                <p className="text-[15px] font-bold text-foreground leading-snug">{aiView}</p>
              )}

              {/* 상세 본문 */}
              {detailText && (
                <p className="text-[13px] text-muted-foreground leading-relaxed">{detailText}</p>
              )}

              {/* fallback: why_notable 불릿 (aiView/detailText 모두 없으면) */}
              {!aiView && !detailText && whyNotable.length > 0 && (
                <div className="space-y-2">
                  {whyNotable.map((point, i) => (
                    <div key={i} className="flex gap-2 text-[13px] text-foreground/80">
                      <span className="text-[color:var(--brand)] shrink-0">•</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 인과관계 흐름도 */}
              {causalFlow.length > 0 && (
                <div className="flex items-center justify-between gap-1.5 pt-2">
                  {causalFlow.map((step, i) => (
                    <div key={i} className="flex items-center gap-1.5 flex-1">
                      <div className="flex-1 flex flex-col items-center gap-1 rounded-xl bg-card border border-border/60 py-2.5 px-1">
                        <span className="text-[18px]">{getCausalEmoji(step, i)}</span>
                        <span className="text-[11px] font-semibold text-foreground text-center leading-tight">{step}</span>
                      </div>
                      {i < causalFlow.length - 1 && (
                        <span className="text-muted-foreground text-[14px]">→</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 섹터별 영향도 progress bar */}
              {sectorImpacts.length > 0 && (
                <div className="rounded-xl bg-card border border-border/60 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12.5px] font-semibold text-foreground">섹터별 영향도</span>
                  </div>
                  <div className="space-y-2">
                    {sectorImpacts.slice(0, 4).map((s) => {
                      const pct = s.impact_pct ?? 0;
                      const isPos = s.direction === "꺍정" || s.direction === "positive";
                      return (
                        <div key={s.sector}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11.5px] font-medium text-foreground">{s.sector}</span>
                            <span className={`text-[11px] font-bold ${isPos ? "text-[color:var(--pos)]" : "text-[color:var(--neg)]"}`}>
                              {isPos ? "+" : "-"}{Math.abs(pct)}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isPos ? "bg-[color:var(--pos)]" : "bg-[color:var(--neg)]"}`}
                              style={{ width: `${Math.min(Math.abs(pct), 100)}%` }}
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
      )}

      {/* 이런 흐름이 보여요 (enriched insights 태그 카드) */}
      {enrichedInsights.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
            <span>💡</span><span>이런 흐름이 보여요</span>
          </div>
          <ul className="space-y-2">
            {enrichedInsights.map((ins, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3">
                <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md bg-[color:var(--brand-sub)] text-white whitespace-nowrap">
                  {ins.tag}
                </span>
                <p className="text-[13px] text-foreground/90 leading-relaxed">{ins.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 어떤 종목이 움직일까요? */}
      {(relatedAssets.length > 0 || hashtags.length > 0) && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
            <span>🧭</span><span>어떤 종목이 움직일까요?</span>
          </div>
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {hashtags.map((tag) => (
                <span key={tag} className="inline-flex items-center text-[12px] font-semibold px-2.5 py-1.5 rounded-full border bg-card text-foreground/80 border-border/60 whitespace-nowrap">{tag}</span>
              ))}
            </div>
          )}
          {relatedAssets.length > 0 && (
            <p className="text-[12px] text-muted-foreground">이 이벤트와 직접적으로 연결된 섹터의 대표 자산을 모았어요.</p>
          )}
          <ul className="space-y-2">
            {relatedAssets.map((asset) => (
              <li key={asset.asset_name} className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3">
                <div>
                  <p className="text-[14px] font-semibold text-foreground">{asset.asset_name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {asset.asset_type && <span>{asset.asset_type}</span>}
                    {asset.reason && <span> · {asset.reason}</span>}
                  </p>
                </div>
                {asset.holding && (
                  <span className="text-[11px] text-[color:var(--brand)] font-medium shrink-0">보유</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
