import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Settings, X, Send, Mic } from "lucide-react";
import { useState } from "react";
import { SectionHeader } from "@/components/pb/SectionHeader";
import { InvestmentSummary } from "@/components/pb/InvestmentSummary";
import { CurrentSituation } from "@/components/pb/CurrentSituation";
import { MasterInsight } from "@/components/pb/MasterInsight";
import { UnexpectedSignal } from "@/components/pb/UnexpectedSignal";
import { SettingsDialog } from "@/components/pb/SettingsDialog";
import { CustomerSelector } from "@/components/pb/CustomerSelector";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const navigate = useNavigate();

  const goToChat = () => {
    navigate({ to: "/chat", search: {} });
  };

  return (
    <div className="min-h-screen bg-surface-muted">
      <div className="max-w-[480px] mx-auto bg-surface-muted">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-surface-muted/85 backdrop-blur-md">
          <div className="flex items-center justify-between px-5 h-14">
            <div className="flex items-center gap-2">
              <span className="size-7 rounded-lg bg-foreground text-background flex items-center justify-center text-[12px] font-bold">
                PB
              </span>
              <span className="text-[15px] font-semibold tracking-tight">AI PB</span>
            </div>
            <div className="flex items-center gap-2 text-foreground/70">
              <CustomerSelector />
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="설정"
                className="size-9 flex items-center justify-center rounded-full hover:bg-muted"
              >
                <Settings className="size-[18px]" />
              </button>
              <button aria-label="닫기" className="size-9 flex items-center justify-center rounded-full hover:bg-muted">
                <X className="size-[18px]" />
              </button>
            </div>
          </div>

          {/* AI PB chat input */}
          <div className="px-4 pb-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                goToChat();
              }}
              className="w-full rounded-full p-px bg-gradient-to-r from-[#C9B5FF] via-[#A8C5FF] to-[#FFB8D8]"
            >
              <div className="flex items-center gap-2 rounded-full bg-white pl-2 pr-1.5 py-1.5">
                <span
                  aria-label="음성 입력"
                  className="size-9 rounded-full flex items-center justify-center text-foreground/70 shrink-0"
                >
                  <Mic className="size-[18px]" />
                </span>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="AI PB에게 물어보세요"
                  className="flex-1 bg-transparent text-[13.5px] text-foreground placeholder:text-muted-foreground outline-none"
                />
                <button
                  type="submit"
                  aria-label="AI PB 챗봇 열기"
                  className="size-9 rounded-full bg-gradient-to-r from-[#C9B5FF] via-[#A8C5FF] to-[#FFB8D8] text-white flex items-center justify-center shrink-0"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </form>
          </div>
        </header>

        <main>
          <SectionHeader
            title="지금 주목할만한 의외의 신호"
            subtitle="데이터에서 발견한 새로운 투자 단서"
          />
          <UnexpectedSignal />


          <SectionHeader title="지금 내 투자 상황" moreTo="/notifications" />
          <CurrentSituation />

          <SectionHeader title="내 포트폴리오 상태 요약" />
          <InvestmentSummary />

          <SectionHeader title="고수들은 지금 이렇게 움직이고 있어요" />
          <MasterInsight />

          <div className="h-6" />
        </main>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
