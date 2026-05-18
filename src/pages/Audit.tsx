import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { auditApi, downloadBase64, extractError } from '@/lib/api';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { formatUnix } from '@/lib/utils';
import type { AuditLog } from '@/types/api';

/**
 * 审计日志页。
 *
 * 布局与 Workers/Runs 统一：ui-card 包 ui-tbl，顶部带过滤栏 + 导出。
 * 过滤改为"草稿/已应用"双态：点搜索按钮才触发 query，避免输入过程中每键发网请求。
 */
export default function AuditPage() {
  const toast = useToast();

  // 草稿态
  const [draftActor, setDraftActor] = useState('');
  const [draftAction, setDraftAction] = useState('');
  const [draftTarget, setDraftTarget] = useState('');

  // 已应用态（实际参与请求）
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const pageSize = 30;

  const filter = {
    actor: actor || undefined,
    action: action || undefined,
    target_type: targetType || undefined,
  };

  const apply = () => {
    setActor(draftActor.trim());
    setAction(draftAction.trim());
    setTargetType(draftTarget);
    setPage(1);
  };
  const reset = () => {
    setDraftActor('');
    setDraftAction('');
    setDraftTarget('');
    setActor('');
    setAction('');
    setTargetType('');
    setPage(1);
  };

  const exportMu = useMutation({
    mutationFn: (fmt: 'csv' | 'json') => auditApi.export(filter, fmt),
    onSuccess: (r) => {
      downloadBase64(r.data, r.content_type, r.filename);
      toast.success(`已导出 ${r.filename}`);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const logs = useQuery({
    queryKey: ['audit', actor, action, targetType, page],
    queryFn: () =>
      auditApi.list({
        ...filter,
        page,
        page_size: pageSize,
      }),
  });

  const total = logs.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight">审计日志</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            记录所有写操作及结果 · 共 {total} 条 · 第 {page} / {totalPages} 页
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="ui-btn ui-btn-default"
            disabled={exportMu.isPending || total === 0}
            onClick={() => exportMu.mutate('csv')}
            title="按当前筛选导出 CSV"
          >
            <Download className="h-3.5 w-3.5" />
            {exportMu.isPending ? '导出中…' : '导出 CSV'}
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-default"
            disabled={exportMu.isPending || total === 0}
            onClick={() => exportMu.mutate('json')}
          >
            <Download className="h-3.5 w-3.5" />
            导出 JSON
          </button>
        </div>
      </div>

      <div className="ui-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border p-4">
          <input
            className="ui-input"
            style={{ width: 180 }}
            placeholder="操作人（精准匹配）"
            value={draftActor}
            onChange={(e) => setDraftActor(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
          />
          <input
            className="ui-input"
            style={{ width: 180 }}
            placeholder="动作（如 update_job）"
            value={draftAction}
            onChange={(e) => setDraftAction(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
          />
          <select
            className="ui-input"
            style={{ width: 160 }}
            value={draftTarget}
            onChange={(e) => setDraftTarget(e.target.value)}
          >
            <option value="">所有对象类型</option>
            <option value="app">应用</option>
            <option value="job">任务</option>
            <option value="rule">告警规则</option>
            <option value="channel">通知渠道</option>
            <option value="user">用户</option>
            <option value="pending_change">双人复核</option>
          </select>
          <button type="button" className="ui-btn ui-btn-primary" onClick={apply}>
            <Search className="h-3.5 w-3.5" />
            搜索
          </button>
          <button type="button" className="ui-btn ui-btn-default" onClick={reset}>
            重置
          </button>
        </div>

        {logs.isLoading ? (
          <Empty text="加载中…" />
        ) : logs.isError ? (
          <Empty text={`加载失败：${extractError(logs.error)}`} danger />
        ) : !logs.data || logs.data.logs.length === 0 ? (
          <Empty text="暂无匹配的审计日志" />
        ) : (
          <>
            <table className="ui-tbl">
              <thead>
                <tr>
                  <th style={{ width: 170 }}>时间</th>
                  <th>操作人</th>
                  <th>动作</th>
                  <th>对象类型</th>
                  <th>对象 ID</th>
                  <th>变更摘要</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.logs.map((log) => (
                  <tr
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => setDetail(log)}
                    title="点击查看完整变更内容"
                  >
                    <td className="text-[12px] text-fg-muted">{formatUnix(log.created_at)}</td>
                    <td className="font-medium">{log.actor || 'system'}</td>
                    <td>
                      <span className="ui-badge ui-badge-default">{actionLabel(log.action)}</span>
                    </td>
                    <td>
                      <span className="ui-badge ui-badge-blue">
                        {targetTypeLabel(log.target_type)}
                      </span>
                    </td>
                    <td className="font-mono text-[12px] text-fg-muted">{log.target_id || '-'}</td>
                    <td className="text-[12px] text-fg-muted">
                      {log.diff?.slice(0, 80)}
                      {log.diff && log.diff.length > 80 ? '…' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[12.5px] text-fg-muted">
              <span>
                共 {total} 条 · 第 {page} / {totalPages} 页
              </span>
              <div className="flex gap-2">
                <button
                  className="ui-btn ui-btn-default ui-btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </button>
                <button
                  className="ui-btn ui-btn-default ui-btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 详情对话框：展示完整 diff（列表里只显示前 80 字符截断） */}
      <Dialog
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail ? `审计详情 #${detail.id}` : ''}
        description={
          detail
            ? `${detail.actor || 'system'} · ${actionLabel(detail.action)} · ${targetTypeLabel(detail.target_type)}:${detail.target_id}`
            : ''
        }
        className="max-w-3xl"
      >
        {detail && (
          <div className="space-y-3 text-[13px]">
            <div className="grid grid-cols-2 gap-3">
              <KvCell label="时间" value={formatUnix(detail.created_at)} />
              <KvCell label="来源 IP" value={detail.actor_ip || '-'} />
              <KvCell label="请求 ID" value={detail.request_id || '-'} />
              <KvCell label="对象 ID" value={detail.target_id || '-'} />
            </div>
            <div>
              <div className="mb-1 text-[12px] font-medium text-fg-muted">变更内容</div>
              <pre className="max-h-[420px] overflow-auto rounded-md border border-border bg-bg p-3 text-[12px] leading-relaxed">
                {prettyJson(detail.diff)}
              </pre>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

function Empty({ text, danger }: { text: string; danger?: boolean }) {
  return (
    <div
      className={`px-4 py-12 text-center text-[13px] ${danger ? 'text-danger' : 'text-fg-muted'}`}
    >
      {text}
    </div>
  );
}

// 动作文本中文化，未知动作原样返回。
function actionLabel(a: string): string {
  const map: Record<string, string> = {
    create: '创建',
    update: '更新',
    delete: '删除',
    disable: '禁用',
    enable: '启用',
    pause: '暂停',
    resume: '恢复',
    trigger: '手动触发',
    cancel: '取消',
    retry: '重试',
    reset_secret: '重置密钥',
    kick: '踢下线',
    invite: '邀请',
    update_role: '修改角色',
    approve: '批准',
    reject: '驳回',
    submit_pending: '提交待审批',
    login: '登录',
    sso_login: 'SSO 登录',
    test: '测试',
    bind: '绑定',
    unbind: '解绑',
    resolve: '解除告警',
    silence: '静默告警',
  };
  return map[a] || a || '-';
}

// 对象类型中文化。
function targetTypeLabel(t: string): string {
  const map: Record<string, string> = {
    app: '应用',
    job: '任务',
    run: '运行',
    worker: 'Worker',
    rule: '告警规则',
    channel: '通知渠道',
    binding: '告警绑定',
    event: '告警事件',
    user: '用户',
    pending_change: '双人复核',
  };
  return map[t] || t || '-';
}

function KvCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-fg-muted">{label}</span>
      <span className="text-[12.5px] font-mono break-all">{value}</span>
    </div>
  );
}

// 优雅打印 JSON；非 JSON 原样返回。
function prettyJson(s: string): string {
  if (!s) return '';
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}