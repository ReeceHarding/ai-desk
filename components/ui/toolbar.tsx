import * as ToolbarPrimitive from "@radix-ui/react-toolbar"
import * as React from "react"

import { cn } from "@/lib/utils"

const Toolbar = React.forwardRef<
  React.ElementRef<typeof ToolbarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.Root
    ref={ref}
    className={cn(
      "flex items-center gap-1 bg-background",
      className
    )}
    {...props}
  />
))
Toolbar.displayName = ToolbarPrimitive.Root.displayName

export { Toolbar }
