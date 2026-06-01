import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { usePortfolioSummary } from "@/hooks/useApiData";
import { useCustomer } from "@/lib/customer-context";

export function InvestmentSummary() {
  const { customer } = useCustomer();
  const { data, loading } = usePortfolioSummary(customer.id);

  const returnPct = data?.total_return_pct ?? 0;
  const topAsset = data?.top_asset_name ?? '—';
  const isPositive = Number(returnPct) >= 0;

  return (
    <div className="px-5 pb-6">
      <div className="relative w-full bg-white rounded-2xl border border-border/70 px-5 py-5 pb-14">
        <p className="text-[13px] text-muted-foreground">전체 계좌 한 줄 요약</p>
        {loading ? (
          <p className="mt-2 text-[15px] text-muted-foreground">불러오는 중...</p>
        ) : (
          <p className="mt-2 text-[17px] font-semibold leading-snug text-foreground">
            어제 대비{" "}
            <span className={isPositive ? "text-[color:var(--up)]" : "text-[color:var(--down)]"}
            >{isPositive ? '+' : ''}{returnPct}%</span> {isPositive ? '올랐고' : '내렸고'},
            <br />{topAsset} 종목이 수익 {isPositive ? '상승' : '변동'}에 한 건 했어요.
          </p>
        )}
        <Link
          to="/chat"
          search={{ autoPrompt: 'portfolio_diagnosis' }}
          className="absolute bottom-3 right-3 inline-flex items-center gap-0.5 text-[12.5px] font-medium text-[#606CF2] hover:underline"
        >
          자세히 알아보기
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
