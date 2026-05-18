import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// 按钮变体定义：保留 shadcn 调用 API，视觉统一切到 RFC-05 原型按钮体系。
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-[6px] whitespace-nowrap rounded-md border border-transparent text-[13px] font-medium transition-all duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-zinc-800 hover:shadow-[0_1px_3px_rgb(0_0_0_/_0.12)]',
        destructive:
          'border-red-200 bg-white text-red-700 hover:bg-danger-bg hover:text-red-700',
        outline:
          'border-border bg-white text-primary hover:bg-bg hover:border-border-strong',
        ghost: 'text-primary hover:bg-hover',
      },
      size: {
        sm: 'h-7 px-2.5 text-[12px]',
        default: 'h-[34px] px-3.5',
        lg: 'h-10 px-5 text-[13.5px]',
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
