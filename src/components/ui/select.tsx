import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * 极简 Select：原生 <select> + Tailwind 样式。
 *
 * 不用自定义下拉 popup：原生控件 a) 系统级渲染避免与 Dialog 层叠冲突，
 * b) 可访问性 / 键盘 / 移动端自动适配。需要 multi-select / search 时再升级。
 */
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full appearance-none rounded-md border border-border bg-white px-3 py-1 pr-8 text-[13px] transition-all duration-150 ease-out',
        'focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
