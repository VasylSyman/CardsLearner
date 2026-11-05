import * as React from 'react'
import { cn } from '@/lib/utils'

function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <kbd className={cn('inline-flex items-center rounded border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium', className)} {...props} />
}

export { Kbd }
