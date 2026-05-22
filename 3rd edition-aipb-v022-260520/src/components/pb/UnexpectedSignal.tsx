import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { HormuzOpportunityDialog } from "./HormuzOpportunityDialog";
import { ChinaTourismOpportunityDialog } from "./ChinaTourismOpportunityDialog";

const items = [
  {
    tag: "해상 운송 데이터",
    title: "호르무즈 해협이 막히면, 의외로 웃는 한국 기업은?",
    key: "hormuz",
  },
  {
    tag: "소비 트렌드",
    title: "유커 돌아온대요. 백화점 말고 오를 곳은 따로 있어요",
    key: "china",
  },
];

export function UnexpectedSignal() {
  const [hormuzOpen, setHormuzOpen] = useState(false);
  const [chinaOpen, setChinaOpen] = useState(false);

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
