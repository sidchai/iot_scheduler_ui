import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * RowMenu：表格行内"更多"操作菜单（编辑/删除等）。
 *
 * 用 details/summary 实现轻量下拉：
 *   - 点击外部自动关闭（浏览器原生行为）
 *   - 点击菜单项后通过 closest('details').removeAttribute('open') 关闭
 *   - 不依赖任何第三方库（Radix Popover）
 *
 * 父级表格 wrapper 不能用 overflow-x-auto，否则会裁切菜单底部。
 */
export interface RowMenuItem {
  label: string;
  onClick: () => void;
  /** danger=true 时显示为红色（删除等危险操作） */
  danger?: boolean;
  /** 隐藏该项（用于条件菜单：已禁用的隐藏"禁用"按钮等） */
  hidden?: boolean;
}

export function RowMenu({ items }: { items: RowMenuItem[] }) {
  const visible = items.filter((i) => !i.hidden);
  if (visible.length === 0) return null;
  return (
    <details className="relative inline-block text-left">
      <summary className="list-none cursor-pointer rounded-md p-1 text-fg-muted transition hover:bg-hover hover:text-fg">
        <MoreHorizontal className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-border bg-white py-1 shadow-menu">
        {visible.map((it, idx) => (
          <button
            key={idx}
            onClick={(e) => {
              const det = (e.currentTarget as HTMLElement).closest('details');
              if (det) det.removeAttribute('open');
              it.onClick();
            }}
            className={cn(
              'block w-full px-3 py-1.5 text-left text-[13px] text-fg transition hover:bg-hover',
              it.danger && 'text-fg-muted hover:bg-danger-bg hover:text-danger',
            )}
          >
            {it.label}
          </button>
        ))}
      </div>
    </details>
  );
}
