import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { MasterInsightDialog } from "./MasterInsightDialog";

type Master = {
  rank: number;
  emoji: string;
  name: string;
  status: string;
  tags: string[];
};

const masters: Master[] = [
  {
    rank: 1,
    emoji: "🔥",
    name: "공격형 주식고수",
    status:
      "대형 IT 기업에 대한 투자 비중을 확대, 국내 증시 강세로 높은 수익을 보이고 있어요",
    tags: ["대형 IT 기업 강세", "변동성 장세 기회 활용"],
  },
  {
    rank: 2,
    emoji: "💎",
    name: "장기형 주식고수",
    status:
      "대형 우량주에 대한 투자 비중을 확대, 시장 불확실성 속 안정적 수익을 추구하고 있어요",
    tags: ["대형 우량주 중심", "장기 투자 확대"],
  },
  {
    rank: 3,
    emoji: "🔍",
    name: "분석형 주식고수",
    status:
      "실적 개선 기업에 집중하며 단기 변동성을 활용한 매매로 수익을 보이고 있어요",
    tags: ["실적 개선 기업", "변동성 장세 수익"],
  },
  {
    rank: 4,
    emoji: "📊",
    name: "금융상품 고수",
    status:
      "채권형 ETF와 배당주 펀드 비중을 늘려 변동성을 방어하고 있어요",
    tags: ["채권형 ETF 확대", "배당주 펀드 선호"],
  },
];

export function MasterInsight() {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-5 pb-6">
      <div className="bg-card rounded-2xl border border-border/70 p-5">
        <p className="text-[13px] text-muted-foreground leading-snug">
          현재 시장 상황에서 가장 뛰어난 성과를 내는
          <br />투자고수는?
        </p>

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
