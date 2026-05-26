import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { MasterInsightDialog } from "./MasterInsightDialog";
import { useTopInvestors } from "@/hooks/useApiData";

type Master = {
  rank: number;
  emoji: string;
  name: string;
  status: string;
  tags: string[];
};

export function MasterInsight() {
  const [open, setOpen] = useState(false);
  const { data, loading } = useTopInvestors(4);

  const masters: Master[] = (data?.investors ?? []).map((inv: any) => ({
    rank: Number(inv.rank),
    emoji: inv.investor_emoji ?? '📊',
    name: `${inv.investor_type} 고수`,
    status: inv.short_status ?? '',
    tags: inv.tags_json ? JSON.parse(inv.tags_json) : [],
  }));

  return (
    <div className="px-5 pb-6">
      <div className="bg-card rounded-2xl border border-border/70 p-5">
        <p className="text-[13px] text-muted-foreground leading-snug">
          현재 시장 상황에서 가장 뛰어난 성과를 내는
          <br />투자고수는?
        </p>

        {loading ? (
          <p className="mt-4 text-[13px] text-muted-foreground">불러오는 중...</p>
        ) : (
        <ul className="mt-4 space-y-2.5">
          {masters.map((m) => (
            <li
              key={m.name}
              className="flex items-start gap-3 rounded-xl bg-background px-3 py-2.5 border border-border/50"
            >
              <span className="shrink-0 w-6 h-6 rounded-full bg-muted text-foreground/80 text-[12px] font-bold flex items-center justify-center">
                {m.rank}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px]">{m.emoji}</span>
                  <span className="text-[13.5px] font-semibold text-foreground truncate">
                    {m.name}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground leading-[1.5]">
                  {m.status}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-full bg-[oklch(0.96_0.03_295)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--brand-sub)]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--info)]"
          >
            자세히 보기
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
      <MasterInsightDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
