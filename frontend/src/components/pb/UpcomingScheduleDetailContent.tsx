import { X, Calendar } from "lucide-react";

export type UpcomingScheduleDetailContentProps = {
  data: any;
  inChat?: boolean;
  onClose?: () => void;
};

export function UpcomingScheduleDetailContent({ data, inChat = false, onClose }: UpcomingScheduleDetailContentProps) {
  if (!data) return null;

  const keyPoints: string[] = data.key_points ?? [];
  const pastCases: { date: string; result: string }[] = data.past_cases ?? [];
  const relatedAssets: { asset_name: string; reason: string }[] = data.related_assets ?? [];

  return (
    <div className={inChat ? "space-y-6" : "px-6 pt-4 pb-3 space-y-6 max-h-[78vh] overflow-y-auto"}>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Calendar className="size-4 text-muted-foreground shrink-0" />
            {data.d_tag && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[color:var(--brand)]/10 text-[color:var(--brand)]">
                {data.d_tag}
              </span>
            )}
            {data.date && <span className="text-[12px] text-muted-foreground">{data.date}</span>}
          </div>
          <h2 className="text-[18px] font-bold text-foreground leading-snug">{data.title}</h2>
          {data.summary && <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">{data.summary}</p>}
        </div>
        {!inChat && onClose && (
          <button onClick={onClose} aria-label="닫기"
            className="size-8 -mr-1 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* 핵심 포인트 */}
      {keyPoints.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
            <span>💡</span><span>이 일정에서 주목할 점</span>
          </div>
          <ul className="space-y-2">
            {keyPoints.map((pt, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-card px-3.5 py-3">
                <span className="text-[color:var(--brand)] mt-0.5 shrink-0 text-[14px]">•</span>
                <p className="text-[13px] text-foreground/90 leading-relaxed">{pt}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 과거 사례 */}
      {pastCases.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
            <span>📈</span><span>과거 이 일정 이후 시장 반응</span>
          </div>
          <ol className="relative space-y-2 pl-4">
            <span className="absolute left-1.5 top-2 bottom-2 w-px bg-border" />
            {pastCases.map((c, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[11px] top-3 size-2 rounded-full ring-2 ring-background bg-[color:var(--brand)]" />
                <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3">
                  <span className="text-[12px] font-semibold text-muted-foreground">{c.date}</span>
                  <p className="mt-1 text-[13px] text-foreground/90 leading-relaxed">{c.result}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 관련 종목 */}
      {relatedAssets.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground tracking-wide">
            <span>🧭</span><span>관련 종목</span>
          </div>
          <ul className="space-y-2">
            {relatedAssets.map((a) => (
              <li key={a.asset_name} className="flex items-center gap-3 rounded-xl border border-border/60 px-3.5 py-3">
                <div className="size-8 rounded-full bg-[color:var(--brand)]/10 flex items-center justify-center shrink-0">
                  <span className="text-[13px] font-bold text-[color:var(--brand)]">📌</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-foreground truncate">{a.asset_name}</div>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{a.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
