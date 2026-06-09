import { ArrowUpRight } from "lucide-react";
import { useRef, useState } from "react";
import { EventDetailDialog } from "./EventDetailDialog";
import { useUnexpectedSignals } from "@/hooks/useApiData";

export function UnexpectedSignal() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const { data, loading } = useUnexpectedSignals(4);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    down: boolean;
    startX: number;
    startScroll: number;
    moved: boolean;
    pointerId: number | null;
    ignoreClickUntil: number;
  }>({
    down: false,
    startX: 0,
    startScroll: 0,
    moved: false,
    pointerId: null,
    ignoreClickUntil: 0,
  });

  const beginDrag = (clientX: number, scrollLeft: number, pointerId?: number) => {
    dragState.current = {
      down: true,
      startX: clientX,
      startScroll: scrollLeft,
      moved: false,
      pointerId: pointerId ?? null,
      ignoreClickUntil: dragState.current.ignoreClickUntil,
    };
  };

  const moveDrag = (clientX: number, el: HTMLDivElement) => {
    if (!dragState.current.down) return;
    const dx = clientX - dragState.current.startX;
    if (Math.abs(dx) > 4) dragState.current.moved = true;
    el.scrollLeft = dragState.current.startScroll - dx;
  };

  const endDrag = (pointerId?: number) => {
    if (pointerId !== undefined && dragState.current.pointerId !== pointerId) return;
    if (dragState.current.moved) dragState.current.ignoreClickUntil = Date.now() + 250;
    dragState.current.down = false;
    dragState.current.moved = false;
    dragState.current.pointerId = null;
  };

  const items = (data?.signals ?? []).slice(0, 4).map((s: any) => ({
    eventId: s.event_id,
    tag: s.enriched_tag ?? s.related_sector ?? "투자 신호",
    title: s.enriched_headline ?? s.event_title ?? "",
  }));

  return (
    <div className="pb-6">
      <div
        ref={scrollerRef}
        onWheel={(e) => {
          const el = scrollerRef.current;
          if (!el) return;
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault();
            el.scrollLeft += e.deltaY;
          }
        }}
        onPointerDownCapture={(e) => {
          beginDrag(e.clientX, e.currentTarget.scrollLeft, e.pointerId);
        }}
        onPointerMoveCapture={(e) => {
          moveDrag(e.clientX, e.currentTarget);
          if (dragState.current.moved) e.preventDefault();
        }}
        onPointerUp={(e) => endDrag(e.pointerId)}
        onPointerCancel={(e) => endDrag(e.pointerId)}
        onPointerLeave={(e) => endDrag(e.pointerId)}
        className="flex w-full min-w-0 gap-3 overflow-x-auto px-5 pb-1 cursor-grab active:cursor-grabbing select-none touch-pan-x overscroll-x-contain scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {loading
          ? [0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-none w-[72%] min-w-[260px] max-w-[320px] rounded-2xl border border-border/70 bg-muted/30 h-24 animate-pulse"
              />
            ))
          : items.map((it) => (
              <button
                key={it.eventId}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                onClick={(e) => {
                  if (Date.now() < dragState.current.ignoreClickUntil) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  setSelectedEventId(it.eventId);
                }}
                className="flex-none w-[72%] min-w-[260px] max-w-[320px] text-left rounded-2xl overflow-hidden border border-border/70 bg-gradient-to-br from-[color:var(--info-soft)] via-muted to-surface-muted hover:opacity-95 transition-opacity"
              >
                <div className="p-4 pointer-events-none">
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
