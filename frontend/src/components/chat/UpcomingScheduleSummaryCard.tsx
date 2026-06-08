import { ChevronRight } from "lucide-react";
import { tagClassName } from "@/components/pb/tag-style";

export type UpcomingScheduleSummaryItem = {
  event_id: string;
  title: string;
  d_tag: string;
  date?: string;
  desc?: string;
};

export type UpcomingScheduleSummaryData = {
  ai_summary?: string;
  items: UpcomingScheduleSummaryItem[];
};

type Props = {
  data: UpcomingScheduleSummaryData;
  onItemClick: (title: string) => void;
};

export function UpcomingScheduleSummaryCard({ data, onItemClick }: Props) {
  return (
    <div className="rounded-2xl bg-card border border-border/70 overflow-hidden">
      <div className="bg-[#606CF2] px-4 py-3">
        <div className="flex items-center gap-1.5 text-[14.5px] font-semibold text-white">
          <span className="text-[15px] leading-none">📅</span>
          다가오는 일정
        </div>
        {data.ai_summary && (
          <p className="mt-0.5 text-[11.5px] text-white/80 leading-snug">{data.ai_summary}</p>
        )}
      </div>
      <div className="space-y-2 px-4 pt-2 pb-3">
        {data.items.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-3 text-center">예정된 일정이 없어요</p>
        ) : (
          data.items.map((it, i) => (
            <button
              key={i}
              onClick={() => onItemClick(it.title)}
              className="w-full text-left rounded-2xl bg-card border border-border/60 px-4 py-3.5 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 min-w-[34px] text-center ${tagClassName(it.d_tag)}`}>
                  {it.d_tag}
                </span>
                {it.date && <span className="text-[12px] text-foreground/70">{it.date}</span>}
                <span className="flex-1" />
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </div>
              <p className="mt-1.5 text-[14.5px] font-bold text-foreground">{it.title}</p>
              {it.desc && <p className="mt-1 text-[12.5px] text-muted-foreground leading-[1.5]">{it.desc}</p>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
