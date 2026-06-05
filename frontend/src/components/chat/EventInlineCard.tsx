import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const TAG_CLASS = "inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-foreground/85 text-background";

type ImpactedAsset = {
  asset_name: string;
  impact_direction: string;
  short_reason: string;
};

export type EventInlineCardProps = {
  event_title: string;
  event_type?: string;
  related_sector?: string;
  ai_investment_view?: string;
  sentiment_score?: number;
  published_at?: string;
  impacted_assets?: ImpactedAsset[];
  tags?: string[];
};

function ImpactIcon({ direction }: { direction: string }) {
  if (direction === "긍정") return <TrendingUp className="size-3.5 text-emerald-600" />;
  if (direction === "부정") return <TrendingDown className="size-3.5 text-red-500" />;
  return <Minus className="size-3.5 text-gray-400" />;
}

function impactBg(direction: string) {
  if (direction === "긍정") return "bg-emerald-50";
  if (direction === "부정") return "bg-red-50";
  return "bg-gray-50";
}

export function EventInlineCard(props: EventInlineCardProps) {
  const { event_title, event_type, related_sector, ai_investment_view, sentiment_score, published_at, impacted_assets, tags } = props;

  const sentimentLabel = sentiment_score !== undefined
    ? sentiment_score > 0.2 ? "긍정" : sentiment_score < -0.2 ? "부정" : "중립"
    : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {event_type && <span className={TAG_CLASS}>{event_type}</span>}
          {related_sector && <span className="text-[11px] text-gray-500">{related_sector}</span>}
          {published_at && <span className="text-[10px] text-gray-400 ml-auto">{published_at}</span>}
        </div>
        <p className="text-[13.5px] font-semibold text-gray-900 leading-snug">{event_title}</p>
      </div>

      {ai_investment_view && (
        <div className="px-3.5 pb-2">
          <p className="text-[12.5px] text-gray-700 leading-relaxed">{ai_investment_view}</p>
        </div>
      )}

      {sentimentLabel && (
        <div className="px-3.5 pb-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${impactBg(sentimentLabel)}`}>
            <ImpactIcon direction={sentimentLabel} />
            <span>시장 감성: {sentimentLabel}</span>
          </span>
        </div>
      )}

      {impacted_assets && impacted_assets.length > 0 && (
        <div className="px-3.5 pb-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-gray-500">영향 종목</p>
          {impacted_assets.slice(0, 4).map((a, i) => (
            <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${impactBg(a.impact_direction)}`}>
              <ImpactIcon direction={a.impact_direction} />
              <span className="text-[12px] font-medium text-gray-800">{a.asset_name}</span>
              <span className="text-[11px] text-gray-500 ml-auto">{a.short_reason}</span>
            </div>
          ))}
        </div>
      )}

      {tags && tags.length > 0 && (
        <div className="px-3.5 pb-3 flex gap-1.5 flex-wrap">
          {tags.map((t, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
