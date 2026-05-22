import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export function InvestmentSummary() {
  return (
    <div className="px-5 pb-6">
      <div className="relative w-full bg-white rounded-2xl border border-border/70 px-5 py-5 pb-14">
        <p className="text-[13px] text-muted-foreground">전체 계좌 한 줄 요약</p>
        <p className="mt-2 text-[17px] font-semibold leading-snug text-foreground">
          어제 대비 <span className="text-[color:var(--up)]">+2.8%</span> 올랐고,
          <br />삼성전자 종목이 수익 상승에 한 건 했어요.
        </p>
        <Link
          to="/chat"
          search={{ view: "asset-analysis" }}
          className="absolute bottom-3 right-3 inline-flex items-center gap-0.5 text-[12.5px] font-medium text-[#606CF2] hover:underline"
        >
          자세히 알아보기
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
