import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer";
import { Drawer as DrawerPrimitive } from "vaul";
import { useNavigate } from "@tanstack/react-router";
import { HoldingDetailContent, type HoldingDetailContentProps, type HistoryEvent } from "./HoldingDetailContent";

export type { HistoryEvent };

type Props = HoldingDetailContentProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function HoldingDetailDialog({ open, onOpenChange, ...contentProps }: Props) {
  const navigate = useNavigate();
  const goChat = () => { onOpenChange(false); navigate({ to: "/chat", search: {} }); };
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[24px] border bg-background max-w-[480px] mx-auto focus:outline-none">
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 rounded-full bg-muted" />
          <DrawerPrimitive.Title className="sr-only">{contentProps.title ?? "종목"} 상세</DrawerPrimitive.Title>
          <HoldingDetailContent {...contentProps} onClose={() => onOpenChange(false)} onGoChat={goChat} />
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
