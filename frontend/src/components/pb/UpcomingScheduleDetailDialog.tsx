import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer";
import { Drawer as DrawerPrimitive } from "vaul";
import { useNavigate } from "@tanstack/react-router";
import { UpcomingScheduleDetailContent } from "./UpcomingScheduleDetailContent";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: any;
  loading?: boolean;
};

export function UpcomingScheduleDetailDialog({ open, onOpenChange, data, loading = false }: Props) {
  const navigate = useNavigate();
  const goChat = () => { onOpenChange(false); navigate({ to: "/chat", search: {} }); };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[24px] border bg-background max-w-[480px] mx-auto focus:outline-none">
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 rounded-full bg-muted" />
          <DrawerPrimitive.Title className="sr-only">
            {data?.title ?? "일정"} 상세
          </DrawerPrimitive.Title>
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-[14px]">
              불러오는 중...
            </div>
          ) : (
            <UpcomingScheduleDetailContent
              data={data}
              onClose={() => onOpenChange(false)}
              onGoChat={goChat}
            />
          )}
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
