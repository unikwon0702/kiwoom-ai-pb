/**
 * RiskAlertInlineCard — 위험 알림 카드 (채팅 인라인 버전)
 * 홈 화면 customer_alerts 스타일을 재사용.
 */

type RiskItem = {
  level: "warning" | "caution" | "good";
  title: string;
  detail?: string;
  asset_name?: string | null;
};

export type RiskAlertInlineCardProps = {
  risk_items: RiskItem[];
  overall_risk_level?: string;
  as_of_date?: string;
};

const LEVEL_STYLE: Record<string, { dot: string; bg: string }> = {
  warning: { dot: "bg-[#EF4444]", bg: "bg-red-50" },
  caution: { dot: "bg-[#F59E0B]", bg: "bg-amber-50" },
  good: { dot: "bg-[#10B981]", bg: "bg-emerald-50" },
};

export function RiskAlertInlineCard(props: RiskAlertInlineCardProps) {
  const { risk_items, overall_risk_level, as_of_date } = props;
  if (!risk_items?.length) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
        <span className="text-[14px]">⚠️</span>
        <span className="text-[12.5px] font-bold text-foreground">위험 신호 감지</span>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {risk_items.length}건{as_of_date ? ` · ${as_of_date}` : ""}
        </span>
      </div>

      {/* Risk Items */}
      <div className="px-3.5 pb-3 space-y-2">
        {risk_items.map((item, idx) => {
          const style = LEVEL_STYLE[item.level] || LEVEL_STYLE.caution;
          return (
            <div key={idx} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg ${style.bg}`}>
              <span className={`size-2 rounded-full mt-1.5 shrink-0 ${style.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-foreground leading-snug">{item.title}</p>
                {item.detail && (
                  <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
