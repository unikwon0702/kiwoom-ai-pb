import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CustomerProvider } from '@/lib/customer-context'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <CustomerProvider>
      <TooltipProvider>
        <Sonner />
        <Outlet />
      </TooltipProvider>
    </CustomerProvider>
  )
}
