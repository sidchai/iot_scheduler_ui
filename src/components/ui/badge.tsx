import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-0.5 text-[11px] font-medium leading-[1.6] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border bg-bg-muted text-fg-muted',
        secondary: 'border-border bg-bg-muted text-fg-muted',
        outline: 'border-border bg-card text-fg',
        success: 'border-success/30 bg-success-bg text-success',
        warning: 'border-warning/30 bg-warning-bg text-warning',
        destructive: 'border-danger/30 bg-danger-bg text-danger',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export type BadgeVariant = NonNullable<BadgeProps['variant']>;

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
