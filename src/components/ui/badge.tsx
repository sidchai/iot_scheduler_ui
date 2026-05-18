import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-px text-[11.5px] font-medium leading-[1.6] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border bg-hover text-zinc-600',
        secondary: 'border-border bg-hover text-zinc-600',
        outline: 'border-border bg-white text-primary',
        success: 'border-emerald-200 bg-success-bg text-emerald-700',
        warning: 'border-amber-200 bg-warning-bg text-amber-700',
        destructive: 'border-red-200 bg-danger-bg text-red-700',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

// 显式导出 BadgeProps 让其他模块可以使用 BadgeProps['variant'] 做 map 类型推导
export type BadgeVariant = NonNullable<BadgeProps['variant']>;

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
