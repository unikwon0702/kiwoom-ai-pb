import { ChevronRight } from "lucide-react";

export type MarketEventSummaryItem = {
  event_id: string;
  title: string;
  time?: string;
  desc?: string;
  hashtags?: string[];
  relevance?: string;
};

export type MarketEventSummaryData = {
  ai_summary?: string;
  items: MarketEventSummaryItem[];
};

type Props = {
  data: MarketEventSummaryData;
  onItemClick: (title: string) => void;
};

export function MarketEventSummaryCard({ data, onItemClick }: Props) {
  return (
    <div className="rounded-2xl bg-card border border-border/70 overflow-hidden">
      <div className="bg-[#606CF2] px-4 py-3">
        <div className="flex items-center gap-1.5 text-[14.5px] font-semibold text-white">
          <span className="text-[15px] leading-none">📰</span>
          이벤트·시황
        </div>
        {data.ai_summary && (
          <p className="mt-0.5 text-[11.5px] text-white/80 leading-snug">{data.ai_summary}</p>
        )}
      </div>
      <div className="space-y-2 px-4 pt-2 pb-3">
        {data.items.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-3 text-center">이벤트 정보가 없어요</p>
        ) : (
          data.items.map((it, i) => (
            <button
              key={i}
              onClick={() => onItemClick(it.title)}
              className="w-full text-left rounded-2xl bg-card border border-border/60 px-4 py-3.5 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start gap-2">
                <span className="flex-1 text-[14.5px] font-bold text-foreground">{it.title}</span>
                {it.time && <span className="text-[12px] text-foreground/60 shrink-0 mt-0.5">{it.time}</span>}
                <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              </div>
              {it.desc && <p className="mt-1 text-[13px] text-foreground/85 leading-[1.5]">{it.desc}</p>}
              {it.hashtags && it.hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                  {it.hashtags.map((h) => (<span key={h} className="text-[12px] text-[color:var(--brand)]">#{h}</span>))}
                </div>
              )}
              {it.relevance && (
                <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <span>🎯</span><span>{it.relevance}</span>
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
