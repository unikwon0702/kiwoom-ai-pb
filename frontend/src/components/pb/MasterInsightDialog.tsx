import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer";
import { Drawer as DrawerPrimitive } from "vaul";
import { useNavigate } from "@tanstack/react-router";
import { MasterInsightContent } from "./MasterInsightContent";
import { AiChatCta } from "./AiChatCta";
import { useTopInvestors } from "@/hooks/useApiData";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function MasterInsightDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { data, loading } = useTopInvestors(3);
  const goChat = () => { onOpenChange(false); navigate({ to: "/chat", search: {} }); };
  const investors = data?.investors ?? [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[24px] border bg-background max-w-[480px] mx-auto focus:outline-none">
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 rounded-full bg-muted" />
          <DrawerPrimitive.Title className="sr-only">투자고수 인사이트</DrawerPrimitive.Title>
          <MasterInsightContent
            investors={investors}
            loading={loading}
            onClose={() => onOpenChange(false)}
          />
          <AiChatCta onClick={goChat} />
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
