import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { EventDetailDialog } from "./EventDetailDialog";
import { useUnexpectedSignals } from "@/hooks/useApiData";

export function UnexpectedSignal() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const { data, loading } = useUnexpectedSignals(4);

  const items = (data?.signals ?? []).slice(0, 2).map((s: any) => ({
    eventId: s.event_id,
    tag: s.enriched_tag ?? s.related_sector ?? "투자 신호",
    title: s.enriched_headline ?? s.event_title ?? "",
  }));

  return (
    <div className="px-5 pb-6">
      <div className="grid grid-cols-2 gap-3">
        {loading
          ? [0, 1].map((i) => (
              <div key={i} className="rounded-2xl border border-border/70 bg-muted/30 h-24 animate-pulse" />
            ))
          : items.map((it) => (
              <button
                key={it.eventId}
                onClick={() => setSelectedEventId(it.eventId)}
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
      <EventDetailDialog
        open={!!selectedEventId}
        onOpenChange={(o) => { if (!o) setSelectedEventId(null); }}
        eventId={selectedEventId}
      />
    </div>
  );
}
