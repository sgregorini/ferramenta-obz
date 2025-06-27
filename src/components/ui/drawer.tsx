"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Drawer = DialogPrimitive.Root
const DrawerTrigger = DialogPrimitive.Trigger
const DrawerClose = DialogPrimitive.Close

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-4 border-t bg-white dark:bg-zinc-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto rounded-t-2xl",
        className
      )}
      {...props}
    >
      {children}
      <DrawerClose className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
        <X size={20} />
      </DrawerClose>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DrawerContent.displayName = "DrawerContent"

export { Drawer, DrawerTrigger, DrawerClose, DrawerContent }
