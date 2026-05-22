import { Send, Mic } from "lucide-react";

export function AiChatCta({ onClick }: { onClick: () => void }) {
  return (
    <div className="border-t border-border/60 bg-background px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <button
        onClick={onClick}
        className="w-full rounded-full p-px bg-gradient-to-r from-[#C9B5FF] via-[#A8C5FF] to-[#FFB8D8]"
      >
        <span className="flex items-center gap-2 rounded-full bg-white pl-2 pr-1.5 py-1.5 text-left">
          <span
            role="button"
            aria-label="음성 입력"
            className="size-9 rounded-full flex items-center justify-center text-foreground/70 shrink-0"
          >
            <Mic className="size-[18px]" />
          </span>
          <span className="flex-1 text-[13.5px] text-muted-foreground">
            AI PB에게 물어보세요
          </span>

          <span className="size-9 rounded-full bg-gradient-to-r from-[#C9B5FF] via-[#A8C5FF] to-[#FFB8D8] text-white flex items-center justify-center shrink-0">
            <Send className="size-4" />
          </span>
        </span>
      </button>
    </div>
  );
}
