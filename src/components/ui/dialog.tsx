import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 极简 Dialog（无 Radix 依赖）：
 *   - 外层 fixed overlay + 中央卡片
 *   - Esc 关闭、点 overlay 关闭、关闭按钮
 *   - createPortal 渲染到 body，不被父容器 overflow:hidden 裁剪
 *
 * 不实现：焦点陷阱 / inert / 动画。控制台场景下足够，需要更完整体验再升级 Radix。
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    // 锁定 body 滚动避免 dialog 内滚动时背景跟着滚
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
      onClick={(e) => {
        // 仅点击 overlay 自己时关闭（不冒泡）
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className={cn(
          'flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_48px_-12px_rgb(0_0_0_/_0.18),0_0_0_1px_rgb(0_0_0_/_0.04)]',
          className,
        )}
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            {title && <h3 className="text-[16px] font-semibold leading-tight">{title}</h3>}
            {description && (
              <p className="mt-1 text-[12px] text-fg-muted">{description}</p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-fg-muted transition hover:bg-hover hover:text-fg"
            aria-label="close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-bg px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * ConfirmDialog：常用确认对话框，封装 Dialog + 标题描述 + 取消/确认按钮。
 *
 * variant=destructive 时确认按钮变红色（删除场景）。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  loading,
  variant = 'default',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  loading?: boolean;
  variant?: 'default' | 'destructive';
}) {
  // 注意：description 只在 body 渲染，不传给 Dialog 的 header，避免与 children 重复显示
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="ui-btn ui-btn-default"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'ui-btn',
              variant === 'destructive' ? 'ui-btn-danger' : 'ui-btn-primary',
            )}
          >
            {loading ? '处理中…' : confirmText}
          </button>
        </>
      }
    >
      <div className="text-[13px] leading-6 text-fg-muted">{description}</div>
    </Dialog>
  );
}
