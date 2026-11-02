import * as React from 'react'
import { DropdownMenu as Menu } from 'radix-ui'
import { cn } from '@dric/ui'

export const Dropdown = Menu.Root
export const DropdownTrigger = Menu.Trigger

export function DropdownContent({ className, align = 'end', ...props }: React.ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-44 rounded-xl border bg-white p-1 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  )
}

export function DropdownItem({
  className,
  danger,
  ...props
}: React.ComponentProps<typeof Menu.Item> & { danger?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground',
        danger && 'text-destructive data-[highlighted]:bg-red-50 [&_svg]:text-destructive',
        className,
      )}
      {...props}
    />
  )
}

export const DropdownSeparator = () => <Menu.Separator className="my-1 h-px bg-border" />
