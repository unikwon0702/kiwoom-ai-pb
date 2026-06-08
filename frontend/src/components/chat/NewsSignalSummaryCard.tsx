import { ChevronRight } from "lucide-react";

export type NewsSignalSummaryItem = {
  news_id: string;
  title: string;
  badge?: string;
  desc?: string;
};

export type NewsSignalSummaryData = {
  ai_summary?: string;
  news_items: NewsSignalSummaryItem[];
};

type Props = {
  data: NewsSignalSummaryData;
  onItemClick: (title: string) => void;
};

export function NewsSignalSummaryCard({ data, onItemClick }: Props) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      {data.ai_summary && (
        <p className="text-[13px] text-muted-foreground mb-3">{data.ai_summary}</p>
      )}
      <div className="flex flex-col gap-2">
        {data.news_items.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-3 text-center">주목할 뉴스가 없어요</p>
        ) : (
          data.news_items.map((item) => (
            <button
              key={item.news_id}
              onClick={() => onItemClick(item.title)}
              className="flex items-center justify-between p-3 rounded-xl bg-background hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {item.badge && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[color:var(--brand)]/10 text-[color:var(--brand)] shrink-0">
                    {item.badge}
                  </span>
                )}
                <span className="text-[13px] font-medium text-left truncate">{item.title}</span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground shrink-0 ml-2" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
