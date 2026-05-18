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

/**
 * 极简 Toast：Context 提供 toast() 方法，全局右下角浮窗。
 *
 * 设计：
 *   - 自动消失（默认 3.5s），可点 × 提前关闭
 *   - 三种 variant：success / error / info；颜色与图标对应
 *   - 不引入第三方库（sonner/react-hot-toast），减少打包体积
 *
 * 用法：
 *   const toast = useToast();
 *   toast.success('已保存');
 *   toast.error('请求失败：xxx');
 */

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
  // 用 ref 维护下一个 id，避免 useState setter 在 strict mode 下双触发导致 id 重复
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { id, message, variant }]);
      // 3.5s 自动消失；error 给更长时间方便用户看
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
  // SSR 兜底：document 可能未定义；当前是纯 CSR，做防御性判断保险
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
        'pointer-events-auto flex items-start gap-3 rounded-[10px] border bg-white p-3 text-[13px] shadow-menu',
        item.variant === 'success' && 'border-emerald-200',
        item.variant === 'error' && 'border-red-200',
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
      <div className="flex-1 break-words">{item.message}</div>
      <button
        onClick={onClose}
        className="text-fg-muted transition hover:text-fg"
        aria-label="close"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
