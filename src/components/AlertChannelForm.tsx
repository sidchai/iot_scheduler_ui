import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { alertApi, extractError } from '@/lib/api';
import type { AlertChannel, AlertChannelType } from '@/types/api';

/**
 * 告警通道表单：创建与编辑共用。
 *
 * 编辑模式下不允许变更 channel_type，避免前端提交后端不接收的字段。
 * secret 留空表示沿用旧密钥，只在创建或明确重置时传入。
 */
const CHANNEL_TYPES: { value: AlertChannelType; label: string }[] = [
  { value: 'ALERT_CHANNEL_FEISHU', label: '飞书' },
  { value: 'ALERT_CHANNEL_DINGTALK', label: '钉钉' },
  { value: 'ALERT_CHANNEL_WECOM', label: '企业微信' },
  { value: 'ALERT_CHANNEL_WEBHOOK', label: '通用 Webhook' },
  { value: 'ALERT_CHANNEL_EMAIL', label: 'Email（占位）' },
];

export function AlertChannelForm({
  open,
  onOpenChange,
  channel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel?: AlertChannel;
}) {
  const isEdit = !!channel;
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState(() => ({
    channel_name: channel?.channel_name ?? '',
    channel_type: (channel?.channel_type ?? 'ALERT_CHANNEL_FEISHU') as AlertChannelType,
    webhook_url: channel?.webhook_url ?? '',
    secret: '',
    template: channel?.template ?? '',
    extra_config: channel?.extra_config ?? '',
  }));

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return alertApi.updateChannel(channel.id, {
          channel_name: form.channel_name,
          webhook_url: form.webhook_url,
          secret: form.secret || undefined,
          template: form.template,
          extra_config: form.extra_config,
        });
      }
      return alertApi.createChannel({
        channel_name: form.channel_name,
        channel_type: form.channel_type,
        webhook_url: form.webhook_url,
        secret: form.secret || undefined,
        template: form.template,
        extra_config: form.extra_config,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertChannels'] });
      toast.success(isEdit ? '通道已更新' : '通道已创建');
      onOpenChange(false);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.channel_name.trim()) return toast.error('channel_name 必填');
    if (!form.webhook_url.trim()) return toast.error('webhook_url 必填');
    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `编辑通道 · ${channel.channel_name}` : '创建通道'}
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
        <Field label="名称" required>
          <Input
            value={form.channel_name}
            onChange={(e) => setForm({ ...form, channel_name: e.target.value })}
            placeholder="例如：飞书运维群"
          />
        </Field>
        <Field label="类型" required>
          <Select
            value={form.channel_type}
            disabled={isEdit}
            onChange={(e) =>
              setForm({ ...form, channel_type: e.target.value as AlertChannelType })
            }
          >
            {CHANNEL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Webhook URL" required>
          <Input
            value={form.webhook_url}
            onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
          />
        </Field>
        <Field
          label={isEdit ? '签名密钥（留空不变）' : '签名密钥（可选）'}
          hint="飞书/钉钉加签机器人；P1 推送链路启用后生效"
        >
          <Input
            type="password"
            value={form.secret}
            onChange={(e) => setForm({ ...form, secret: e.target.value })}
            placeholder={isEdit ? '••••••' : ''}
          />
        </Field>
        <Field label="消息模板" hint="留空使用默认模板">
          <textarea
            value={form.template}
            onChange={(e) => setForm({ ...form, template: e.target.value })}
            rows={3}
            className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-[13px] focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            placeholder="支持 {{.JobName}} {{.Summary}} 等变量"
          />
        </Field>
        <Field label="额外配置（JSON）" hint="可选；预留扩展字段">
          <textarea
            value={form.extra_config}
            onChange={(e) => setForm({ ...form, extra_config: e.target.value })}
            rows={2}
            className="flex w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-[12px] focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            placeholder='{"at_all": false}'
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