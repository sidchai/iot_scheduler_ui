import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { appApi, extractError } from '@/lib/api';
import type { App } from '@/types/api';

/**
 * AppForm：应用列表页的创建/编辑表单。
 *
 * 创建模式成功后展示一次性 app_secret；编辑模式只更新可变字段。
 * 成功后通过 react-query invalidate 刷新应用列表。
 */
export function AppForm({
  open,
  onOpenChange,
  app,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app?: App;
}) {
  const isEdit = !!app;
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState(() => ({
    app_name: app?.app_name ?? '',
    owner: app?.owner ?? '',
    description: app?.description ?? '',
    qps_quota: app?.qps_quota ?? 1000,
    payload_max_bytes: app?.payload_max_bytes ?? 32 * 1024,
    webhook_url: app?.webhook_url ?? '',
  }));
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return appApi.update(app.app_name, {
          owner: form.owner,
          description: form.description,
          qps_quota: form.qps_quota,
          payload_max_bytes: form.payload_max_bytes,
          webhook_url: form.webhook_url,
        });
      }
      return appApi.create({
        app_name: form.app_name,
        owner: form.owner,
        description: form.description,
        qps_quota: form.qps_quota,
        payload_max_bytes: form.payload_max_bytes,
        webhook_url: form.webhook_url,
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['apps'] });
      if (isEdit) {
        toast.success('应用已更新');
        onOpenChange(false);
      } else {
        const created = data as { app: App; app_secret: string };
        setCreatedSecret(created.app_secret);
        toast.success(`应用 ${created.app.app_name} 已创建`);
      }
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isEdit && !form.app_name.trim()) {
      toast.error('app_name 必填');
      return;
    }
    if (!form.owner.trim()) {
      toast.error('owner 必填');
      return;
    }
    mutation.mutate();
  };

  if (createdSecret) {
    return (
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setCreatedSecret(null);
            onOpenChange(false);
          }
        }}
        title="应用创建成功 · 请立即保存 app_secret"
        description="此密钥仅展示一次，关闭后无法再查看；如丢失需重置。"
        footer={
          <Button
            onClick={() => {
              setCreatedSecret(null);
              onOpenChange(false);
            }}
          >
            我已复制保存
          </Button>
        }
      >
        <SecretDisplay value={createdSecret} />
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `编辑应用 · ${app.app_name}` : '创建应用'}
      description={isEdit ? 'app_name 不可修改；其余字段会立即生效。' : undefined}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? '提交中…' : isEdit ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="app_name" required>
          <Input
            value={form.app_name}
            disabled={isEdit}
            onChange={(e) => setForm({ ...form, app_name: e.target.value })}
            placeholder="例如：order-service"
          />
        </Field>
        <Field label="owner" required>
          <Input
            value={form.owner}
            onChange={(e) => setForm({ ...form, owner: e.target.value })}
            placeholder="负责人 / 团队"
          />
        </Field>
        <Field label="描述">
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="QPS 配额">
            <Input
              type="number"
              min={1}
              value={form.qps_quota}
              onChange={(e) =>
                setForm({ ...form, qps_quota: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="payload 上限（字节）" hint="≤ 256 KB">
            <Input
              type="number"
              min={1}
              max={256 * 1024}
              value={form.payload_max_bytes}
              onChange={(e) =>
                setForm({ ...form, payload_max_bytes: Number(e.target.value) || 0 })
              }
            />
          </Field>
        </div>
        <Field label="Webhook URL" hint="可选；任务结果回调地址">
          <Input
            value={form.webhook_url}
            onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
            placeholder="https://..."
          />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
        {hint && <span className="ml-2 text-xs text-fg-muted">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}

/**
 * SecretDisplay：明文密钥展示与一键复制入口。
 */
export function SecretDisplay({ value }: { value: string }) {
  const toast = useToast();
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败，请手动选中文本');
    }
  };
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
        请立即复制并妥善保存。关闭弹窗后无法再次获取，丢失需重置。
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-hover/40 p-3">
        <code className="flex-1 break-all font-mono text-sm">{value}</code>
        <Button variant="outline" size="sm" onClick={onCopy}>
          <Copy className="h-4 w-4" /> 复制
        </Button>
      </div>
    </div>
  );
}