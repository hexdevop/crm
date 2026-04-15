import { cn } from '@/utils/cn'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const sizeCls: Record<Size, string> = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
}

export default function Spinner({
  size = 'md',
  className,
}: {
  size?: Size
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-full border-current border-r-transparent animate-spin',
        sizeCls[size],
        className
      )}
    />
  )
}
