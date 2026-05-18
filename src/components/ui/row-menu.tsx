import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RowMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

export function RowMenu({ items }: { items: RowMenuItem[] }) {
  const visible = items.filter((i) => !i.hidden);
  if (visible.length === 0) return null;
  return (
    <details className="relative inline-block text-left">
      <summary className="list-none cursor-pointer rounded-lg p-1.5 text-fg-muted transition hover:bg-bg-muted hover:text-fg">
        <MoreHorizontal className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-border bg-card py-1 shadow-menu">
        {visible.map((it, idx) => (
          <button
            key={idx}
            onClick={(e) => {
              const det = (e.currentTarget as HTMLElement).closest('details');
              if (det) det.removeAttribute('open');
              it.onClick();
            }}
            className={cn(
              'block w-full px-3 py-2 text-left text-[13px] text-fg transition hover:bg-bg-muted',
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
