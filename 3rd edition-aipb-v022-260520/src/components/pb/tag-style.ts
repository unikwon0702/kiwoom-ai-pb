export function tagClassName(tag: string) {
  // 보유 — 메인 브랜드
  if (tag === "보유") return "bg-[color:var(--info-soft)] text-[color:var(--brand)]";
  // 관심 — 서브 컬러
  if (tag === "관심") return "bg-[oklch(0.96_0.03_295)] text-[color:var(--brand-sub)]";
  // 호재/상승/방금 — 좋은 소식
  if (tag === "호재" || tag === "방금") return "bg-[color:var(--pos-soft)] text-[color:var(--pos)]";
  // 악재/하락 — 나쁜 소식
  if (tag === "악재") return "bg-[color:var(--neg-soft)] text-[color:var(--neg)]";
  // D-day — 일정
  if (/^D-/.test(tag)) return "bg-[oklch(0.96_0.05_75)] text-[oklch(0.48_0.13_70)]";
  return "bg-muted text-muted-foreground/80";
}
