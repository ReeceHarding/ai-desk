import * as AvatarPrimitive from "@radix-ui/react-avatar"
import * as React from "react"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> & { fallbackText?: string }
>(({ className, src, fallbackText, ...props }, ref) => {
  const [error, setError] = React.useState(false);

  // Don't render image if src is missing or previous load errored
  if (!src || error) return null;
  
  return (
    <AvatarPrimitive.Image
      ref={ref}
      src={src}
      onError={() => setError(true)}
      className={cn("aspect-square h-full w-full", className)}
      {...props}
    />
  );
})
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> & { text?: string }
>(({ className, text, children, ...props }, ref) => {
  // Generate initials from text if provided
  const initials = text
    ? text
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium",
        className
      )}
      {...props}
    >
      {children || initials || '?'}
    </AvatarPrimitive.Fallback>
  );
})
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarFallback, AvatarImage }

