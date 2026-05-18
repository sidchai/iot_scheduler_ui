import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent text-[13px] font-medium transition-all duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-fg text-bg hover:bg-fg/90',
        destructive: 'border-danger/30 bg-danger-bg text-danger hover:bg-danger/20',
        outline: 'border-border bg-card text-fg hover:bg-bg-muted hover:border-border-strong',
        ghost: 'text-fg hover:bg-bg-muted',
        secondary: 'bg-bg-muted text-fg hover:bg-border',
      },
      size: {
        sm: 'h-8 px-3 text-[12px]',
        default: 'h-9 px-4',
        lg: 'h-11 px-6 text-[14px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
