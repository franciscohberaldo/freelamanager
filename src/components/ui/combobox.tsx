"use client"

import { useState } from "react"
import { Command } from "cmdk"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
}

interface Props {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
}

/**
 * A select with a type-to-filter search box, for long lists (clients, jobs).
 * Looks like a SelectTrigger on the outside; inside, a cmdk list does the filtering.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Selecione…",
  searchPlaceholder = "Buscar…",
  emptyText = "Nenhum resultado.",
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)

  return (
    // modal keeps focus contained when the combobox lives inside a Dialog
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverAnchor asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            className
          )}
        >
          <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <Command>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              autoFocus
              placeholder={searchPlaceholder}
              className="flex h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-1">
            <Command.Empty className="py-4 text-center text-sm text-muted-foreground">
              {emptyText}
            </Command.Empty>
            {options.map(o => (
              <Command.Item
                key={o.value}
                value={o.label}
                onSelect={() => { onChange(o.value); setOpen(false) }}
                className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {o.value === value && <Check className="h-4 w-4" />}
                </span>
                {o.label}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
