import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";

export type NewsSignalDetailContentProps = {
  data: any;
  inChat?: boolean;
  onClose?: () => void;
};

function ImpactBadge({ direction, pct }: { direction: string; pct?: number }) {
  const isPos = direction === "positive" || direction === "긍정";
  const isNeg = direction === "negative" || direction === "부정";
  const Icon = isPos ? TrendingUp : isNeg ? TrendingDown : Minus;
  const cls = isPos ? "text-[color:var(--pos)]" : isNeg ? "text-[color:var(--neg)]" : "text-muted-foreground";
  const bgCls = isPos ? "bg-[color:var(--pos-soft)]" : isNeg ? "bg-[color:var(--neg-soft)]" : "bg-muted";
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[12px] font-bold ${bgCls} ${cls}`}>
      <Icon className="size-3" />
      {pct != null ? `${isPos ? "+" : "-"}${Math.abs(pct)}%` : (isPos ? "긍정" : isNeg ? "부정" : "중립")}
    </span>
  );
}

export function NewsSignalDetailContent({ data, inChat = false, onClose }: NewsSignalDetailContentProps) {
  if (!data) return null;

  const whyNotable: string[] = data.why_notable ?? [];
  const sectorImpacts: { sector: string; direction: string; impact_pct?: number }[] = data.sector_impacts ?? [];
  const hashtags: string[] = data.hashtags ?? [];
  const relatedAssets: { asset_name: string; asset_type?: string; reason?: string; holding?: boolean }[] = data.related_assets ?? [];

  return (
    <div className={inChat ? "px-6 pt-4 pb-3 space-y-6" : "px-6 pt-4 pb-3 space-y-6 max-h-[78vh] overflow-y-auto"}>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11.5px] text-muted-foreground mb-0.5">의외의 신호</p>
          <h2 className="text-[18px] font-bold text-foreground leading-snug">{data.title}</h2>
        </div>
        {!inChat && onClose && (
          <button onClick={onClose} aria-label="닫기"
            className="size-8 -mr-1 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* 지금 왜 주목해야 할까요? */}
      {whyNotable.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
            <span>⚡</span><span>지금 왜 주목해야 할까요?</span>
          </div>
          <div className="rounded-2xl bg-muted/40 px-4 py-3.5 space-y-2">
            {whyNotable.map((point, i) => (
              <div key={i} className="flex gap-2 text-[13px] text-foreground/80">
                <span className="text-[color:var(--brand)] shrink-0">•</span>
                <span>{point}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 섹터별 영향도 */}
      {sectorImpacts.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
            <span>📊</span><span>섹터별 영향도</span>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            {sectorImpacts.map((s, i) => (
              <div key={s.sector} className={`flex justify-between items-center px-4 py-3 ${i < sectorImpacts.length - 1 ? "border-b border-border/60" : ""}`}>
                <span className="text-[13px] font-medium text-foreground">{s.sector}</span>
                <ImpactBadge direction={s.direction} pct={s.impact_pct} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 어떤 종목이 움직일까요? */}
      {(relatedAssets.length > 0 || hashtags.length > 0) && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
            <span>🧭</span><span>어떤 종목이 움직일까요?</span>
          </div>
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {hashtags.map((tag) => (
                <span key={tag} className="inline-flex items-center text-[12px] font-semibold px-2.5 py-1.5 rounded-full border bg-card text-foreground/80 border-border/60 whitespace-nowrap">{tag}</span>
              ))}
            </div>
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
