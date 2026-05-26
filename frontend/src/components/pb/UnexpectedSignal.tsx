import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { HormuzOpportunityDialog } from "./HormuzOpportunityDialog";
import { ChinaTourismOpportunityDialog } from "./ChinaTourismOpportunityDialog";
import { useUnexpectedSignals } from "@/hooks/useApiData";

export function UnexpectedSignal() {
  const [hormuzOpen, setHormuzOpen] = useState(false);
  const [chinaOpen, setChinaOpen] = useState(false);
  const { data, loading } = useUnexpectedSignals(4);

  const items = (data?.signals ?? []).slice(0, 2).map((s: any, i: number) => ({
    tag: s.related_sector ?? s.event_type ?? '투자 신호',
    title: s.event_title ?? '',
    key: i === 0 ? 'hormuz' : 'china',
  }));

  return (
    <div className="px-5 pb-6">
      <div className="grid grid-cols-2 gap-3">
        {items.map((it) => (
          <button
            key={it.key}
            onClick={() => {
              if (it.key === "hormuz") setHormuzOpen(true);
              if (it.key === "china") setChinaOpen(true);
            }}
            className="text-left rounded-2xl overflow-hidden border border-border/70 bg-gradient-to-br from-[color:var(--info-soft)] via-muted to-surface-muted hover:opacity-95 transition-opacity"
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-foreground/85 text-background">
                  {it.tag}
                </span>
                <ArrowUpRight className="size-4 text-foreground/60 shrink-0" />
              </div>
              <p className="text-[14px] font-bold leading-snug text-foreground">
                {it.title}
              </p>
            </div>
          </button>
        ))}
      </div>
      <HormuzOpportunityDialog open={hormuzOpen} onOpenChange={setHormuzOpen} />
      <ChinaTourismOpportunityDialog open={chinaOpen} onOpenChange={setChinaOpen} />
    </div>
  );
}
