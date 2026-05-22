import { Link } from "@tanstack/react-router";

export function SectionHeader({
  title,
  subtitle,
  moreTo,
}: {
  title: string;
  subtitle?: string;
  moreTo?: string;
}) {
  return (
    <div className="px-5 pt-8 pb-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-[17px] font-bold text-foreground tracking-tight">{title}</h2>
        {moreTo && (
          <Link
            to={moreTo as "/notifications"}
            className="text-[12.5px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            더보기 →
          </Link>
        )}
      </div>
      {subtitle && <p className="text-[13px] text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
