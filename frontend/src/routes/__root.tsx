import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <TooltipProvider>
      <Sonner />
      <Outlet />
    </TooltipProvider>
  )
}
