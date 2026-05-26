import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Outlet />
    </TooltipProvider>
  )
}
