import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Stub 页面：尚未实现功能的占位页。
 *
 * 路由未完成时展示明确状态，避免用户看到空白屏。
 */
export default function Stub({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-fg-muted">
          <Construction className="h-12 w-12" />
          <div className="text-sm">该页面即将上线（P0+ 后续迭代）</div>
        </CardContent>
      </Card>
    </div>
  );
}