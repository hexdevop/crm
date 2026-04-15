import { cn } from '@/utils/cn'

type Variant = 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple' | 'indigo'

const variantCls: Record<Variant, string> = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  gray: 'bg-slate-100 text-slate-600 ring-slate-200',
  purple: 'bg-purple-50 text-purple-700 ring-purple-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
}

interface BadgeProps {
  variant?: Variant
  children: React.ReactNode
  className?: string
  dot?: boolean
}

export default function Badge({
  variant = 'gray',
  children,
  className,
  dot,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset',
        variantCls[variant],
        className
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full bg-current opacity-70')} />
      )}
      {children}
    </span>
  )
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'green' : 'red'} dot>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}
