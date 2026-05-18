import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => remove(id), variant === 'error' ? 5000 : 3500);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onRemove={remove} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  items,
  onRemove,
}: {
  items: ToastItem[];
  onRemove: (id: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || items.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {items.map((t) => (
        <ToastCard key={t.id} item={t} onClose={() => onRemove(t.id)} />
      ))}
    </div>,
    document.body,
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const Icon =
    item.variant === 'success'
      ? CheckCircle2
      : item.variant === 'error'
        ? AlertCircle
        : Info;
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-xl border bg-card p-4 text-[13px] shadow-menu',
        item.variant === 'success' && 'border-success/30',
        item.variant === 'error' && 'border-danger/30',
        item.variant === 'info' && 'border-border',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          item.variant === 'success' && 'text-success',
          item.variant === 'error' && 'text-danger',
          item.variant === 'info' && 'text-fg-muted',
        )}
      />
      <div className="flex-1 break-words text-fg">{item.message}</div>
      <button
        onClick={onClose}
        className="rounded-md p-0.5 text-fg-muted transition hover:bg-bg-muted hover:text-fg"
        aria-label="close"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
