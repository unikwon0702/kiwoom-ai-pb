/**
 * MarketContextInlineCard — 시장 상황 카드 (채팅 인라인 버전)
 * 홈 화면 MarketEventDetailDialog 내부 렌더링을 추출.
 */

type IndexData = {
  name: string;
  value: string | number;
  change: string;
};

export type MarketContextInlineCardProps = {
  market_date?: string;
  market_summary: string;
  risk_level?: "good" | "caution" | "warning";
  indices?: IndexData[];
  regime?: string;
};

const REGIME_LABEL: Record<string, { label: string; color: string }> = {
  "risk-off": { label: "하락 조정", color: "text-[color:var(--neg)]" },
  "risk-on": { label: "상승 국면", color: "text-[color:var(--pos)]" },
  neutral: { label: "보합 국면", color: "text-muted-foreground" },
};

export function MarketContextInlineCard(props: MarketContextInlineCardProps) {
  const { market_date, market_summary, risk_level, indices, regime } = props;
  const regimeInfo = regime ? REGIME_LABEL[regime] || REGIME_LABEL.neutral : null;

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
        <span className="text-[14px]">📈</span>
        <span className="text-[12.5px] font-bold text-foreground">시장 현황</span>
        {market_date && <span className="text-[10px] text-muted-foreground ml-auto">{market_date}</span>}
      </div>

      {/* Summary */}
      <div className="px-3.5 pb-2">
        <p className="text-[12.5px] text-foreground/85 leading-relaxed">{market_summary}</p>
        {regimeInfo && (
          <span className={`inline-block mt-1.5 text-[11px] font-semibold ${regimeInfo.color}`}>
            시장 국면: {regimeInfo.label}
          </span>
        )}
      </div>

      {/* Indices */}
      {indices && indices.length > 0 && (
        <div className="px-3.5 pb-3">
          <div className="grid grid-cols-2 gap-2">
            {indices.map((idx, i) => (
              <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/50">
                <span className="text-[11px] text-muted-foreground">{idx.name}</span>
                <div className="text-right">
                  <span className="text-[11.5px] font-semibold text-foreground">{idx.value}</span>
                  <span className={`text-[10px] ml-1 ${
                    idx.change.startsWith("-") ? "text-[color:var(--neg)]" :
                    idx.change.startsWith("+") ? "text-[color:var(--pos)]" : "text-muted-foreground"
                  }`}>{idx.change}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
