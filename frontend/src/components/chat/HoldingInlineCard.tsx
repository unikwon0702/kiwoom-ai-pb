export type HoldingInlineCardProps = {
  asset_name: string;
  holding_type?: string;
  signal_name?: string;
  interpretation?: string;
  return_rate?: string;
  valuation?: string;
  weight?: string;
  risk_level?: "good" | "caution" | "warning";
};

const BORDER: Record<string, string> = {
  good: "border-l-emerald-500",
  caution: "border-l-amber-400",
  warning: "border-l-red-500",
};

export function HoldingInlineCard(props: HoldingInlineCardProps) {
  const { asset_name, holding_type, signal_name, interpretation, return_rate, valuation, weight, risk_level } = props;
  const borderCls = risk_level ? BORDER[risk_level] || "" : "";

  return (
    <div className={`rounded-xl border border-gray-200 bg-white overflow-hidden border-l-[3px] ${borderCls}`}>
      <div className="px-3.5 py-3">
        <div className="flex items-center gap-2 mb-2">
          {holding_type && (
            <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-gray-800 text-white">{holding_type}</span>
          )}
          <span className="text-[14px] font-bold text-gray-900">{asset_name}</span>
          {return_rate && (
            <span className={`text-[12px] font-semibold ml-auto ${
              String(return_rate).startsWith("+") ? "text-emerald-600" :
              String(return_rate).startsWith("-") ? "text-red-500" : "text-gray-700"
            }`}>
              {return_rate}
            </span>
          )}
        </div>

        {signal_name && (
          <div className="mb-1.5">
            <span className="text-[12.5px] font-semibold text-gray-800">{signal_name}</span>
          </div>
        )}

        {interpretation && (
          <p className="text-[12px] text-gray-500 leading-relaxed">{interpretation}</p>
        )}

        {(valuation || weight) && (
          <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100">
            {valuation && (
              <div>
                <span className="text-[10px] text-gray-400">평가금액</span>
                <p className="text-[12px] font-semibold text-gray-800">{valuation}</p>
              </div>
            )}
            {weight && (
              <div>
                <span className="text-[10px] text-gray-400">비중</span>
                <p className="text-[12px] font-semibold text-gray-800">{weight}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
