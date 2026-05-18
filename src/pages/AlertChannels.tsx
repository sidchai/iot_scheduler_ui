import { useState, type ComponentType, type SVGProps } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe2, Mail, MessageSquare, Plus, Send, Zap } from 'lucide-react';
import { alertApi, extractError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { AlertChannelForm } from '@/components/AlertChannelForm';
import { cn } from '@/lib/utils';
import type { AlertChannel } from '@/types/api';

/**
 * 告警通道列表：按 RFC-05 图 4 改为渠道卡片，而不是传统表格。
 *
 * 列表仍复用原有 CRUD / 测试推送接口；状态徽章可点击切换启停，避免新增按钮破坏原型布局。
 */
const typeMeta: Record<
  string,
  { icon: ComponentType<SVGProps<SVGSVGElement>>; iconClass: string; defaultName: string }
> = {
  ALERT_CHANNEL_FEISHU: {
    icon: MessageSquare,
    iconClass: 'bg-blue-600 text-white',
    defaultName: '飞书',
  },
  ALERT_CHANNEL_DINGTALK: {
    icon: Zap,
    iconClass: 'bg-sky-500 text-white',
    defaultName: '钉钉',
  },
  ALERT_CHANNEL_WECOM: {
    icon: Send,
    iconClass: 'bg-emerald-500 text-white',
    defaultName: '企业微信',
  },
  ALERT_CHANNEL_WEBHOOK: {
    icon: Globe2,
    iconClass: 'bg-orange-500 text-white',
    defaultName: 'Webhook',
  },
  ALERT_CHANNEL_EMAIL: {
    icon: Mail,
    iconClass: 'bg-zinc-600 text-white',
    defaultName: '邮件',
  },
};

export default function AlertChannelsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AlertChannel | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<AlertChannel | null>(null);

  const channels = useQuery({
    queryKey: ['alertChannels'],
    queryFn: () => alertApi.listChannels(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => alertApi.deleteChannel(id),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || '删除失败');
      qc.invalidateQueries({ queryKey: ['alertChannels'] });
      toast.success('通道已删除');
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const testMutation = useMutation({
    mutationFn: (c: AlertChannel) => alertApi.testChannel(c.id, '这是一条测试消息'),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['alertChannels'] });
      if (data.ok) toast.success(`推送成功（${data.latency_ms}ms）`);
      else toast.error(`推送失败：${data.error}`);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: (c: AlertChannel) => alertApi.updateChannel(c.id, { enabled: !c.enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertChannels'] });
      toast.success('已切换状态');
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (c: AlertChannel) => {
    setEditing(c);
    setFormOpen(true);
  };

  return (
    <div>
      <div className="mb-7 flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">通知渠道</h1>
          <p className="mt-1.5 text-[14px] text-fg-muted">告警触发后将通过这些渠道发送</p>
        </div>
        <Button onClick={openCreate} className="h-9 rounded-md bg-zinc-950 px-4 text-[13px] hover:bg-zinc-800">
          <Plus className="h-3.5 w-3.5" /> 新建渠道
        </Button>
      </div>

      {channels.isLoading && <div className="p-12 text-center text-[13px] text-fg-muted">加载中…</div>}
      {channels.isError && (
        <div className="p-12 text-center text-[13px] text-danger">加载失败：{extractError(channels.error)}</div>
      )}
      {channels.data && channels.data.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-white py-16 text-center text-[13px] text-fg-muted">
          暂无通道，点击右上角创建第一个通知渠道。
        </div>
      )}
      {channels.data && channels.data.length > 0 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 lg:grid-cols-2">
          {channels.data.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onEdit={() => openEdit(channel)}
              onDelete={() => setDeleteTarget(channel)}
              onTest={() => testMutation.mutate(channel)}
              onToggle={() => toggleMutation.mutate(channel)}
              testing={testMutation.isPending}
              toggling={toggleMutation.isPending}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <AlertChannelForm
          key={editing?.id ?? 'create'}
          open={formOpen}
          onOpenChange={setFormOpen}
          channel={editing}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`删除通道 ${deleteTarget?.channel_name}？`}
        description="关联的绑定会被一并解除。操作不可撤销。"
        variant="destructive"
        confirmText="删除"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function ChannelCard({
  channel,
  onEdit,
  onDelete,
  onTest,
  onToggle,
  testing,
  toggling,
}: {
  channel: AlertChannel;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onToggle: () => void;
  testing: boolean;
  toggling: boolean;
}) {
  const meta = typeMeta[channel.channel_type] ?? typeMeta.ALERT_CHANNEL_WEBHOOK;
  const Icon = meta.icon;
  return (
    <article className="rounded-xl border border-border bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg', meta.iconClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={toggling}
          className={cn(
            'ui-badge transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60',
            channel.enabled ? 'ui-badge-success' : 'ui-badge-default',
          )}
          title="点击切换启停状态"
        >
          {channel.enabled ? '启用' : '停用'}
        </button>
      </div>

      <div className="mt-5">
        <h2 className="text-[17px] font-semibold leading-tight text-fg">
          {channel.channel_name || meta.defaultName}
        </h2>
        <p className="mt-2 truncate text-[13px] text-fg-muted">
          {compactWebhook(channel.webhook_url)} · {testSummary(channel)}
        </p>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onTest}
            disabled={testing}
            className="ui-btn ui-btn-default justify-center"
          >
            测试发送
          </button>
          <button type="button" onClick={onEdit} className="ui-btn ui-btn-ghost justify-center">
            编辑
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 text-[12px] text-fg-subtle transition hover:text-danger"
        >
          删除通道
        </button>
      </div>
    </article>
  );
}

function compactWebhook(url: string): string {
  if (!url) return '未配置 webhook';
  const trimmed = url.trim();
  if (trimmed.length <= 10) return trimmed;
  return `...${trimmed.slice(-6)}`;
}

function testSummary(channel: AlertChannel): string {
  if (channel.last_test_at <= 0) return '未测试';
  return channel.last_test_ok ? '最近测试通过' : '最近测试失败';
}