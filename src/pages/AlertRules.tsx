import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { alertApi, extractError } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { RowMenu } from '@/components/ui/row-menu';
import { useToast } from '@/components/ui/toast';
import { AlertRuleForm } from '@/components/AlertRuleForm';
import { formatUnix } from '@/lib/utils';
import type { AlertRule } from '@/types/api';

/**
 * 告警规则列表：支持 keyword 与 enabled_only 过滤。
 *
 * condition_type 只在展示层做中文映射；实际规则语义由后端评估器保证。
 */
const conditionLabel: Record<string, string> = {
  ALERT_CONDITION_CONSECUTIVE_FAIL: '连续失败',
  ALERT_CONDITION_TIMEOUT: '超时',
  ALERT_CONDITION_DISPATCH_FAIL: '派发失败',
  ALERT_CONDITION_SUCCESS_RATE_BELOW: '成功率低',
};

export default function AlertRulesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [keyword, setKeyword] = useState('');
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AlertRule | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<AlertRule | null>(null);

  const rules = useQuery({
    queryKey: ['alertRules', keyword, enabledOnly],
    queryFn: () =>
      alertApi.listRules({
        keyword: keyword || undefined,
        enabled_only: enabledOnly || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => alertApi.deleteRule(id),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || '删除失败');
      qc.invalidateQueries({ queryKey: ['alertRules'] });
      toast.success('规则已删除');
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: (r: AlertRule) => alertApi.updateRule(r.id, { ...r, enabled: !r.enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertRules'] });
      toast.success('已切换状态');
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (r: AlertRule) => {
    setEditing(r);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">告警规则</h1>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={enabledOnly}
              onChange={(e) => setEnabledOnly(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            仅启用
          </label>
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-fg-muted" />
            <Input
              placeholder="rule_name"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> 新建
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">共 {rules.data?.length ?? 0} 条规则</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.isLoading && <div className="text-sm text-fg-muted">加载中…</div>}
          {rules.isError && (
            <div className="text-sm text-danger">加载失败：{extractError(rules.error)}</div>
          )}
          {rules.data && rules.data.length === 0 && (
            <div className="rounded-md border border-dashed border-border py-12 text-center text-sm text-fg-muted">
              暂无规则
            </div>
          )}
          {rules.data && rules.data.length > 0 && (
            <div>
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-fg-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">规则名</th>
                    <th className="py-2 pr-4 font-medium">条件</th>
                    <th className="py-2 pr-4 font-medium">阈值</th>
                    <th className="py-2 pr-4 font-medium">窗口</th>
                    <th className="py-2 pr-4 font-medium">静默</th>
                    <th className="py-2 pr-4 font-medium">绑定</th>
                    <th className="py-2 pr-4 font-medium">状态</th>
                    <th className="py-2 pr-4 font-medium">创建</th>
                    <th className="w-20 py-2 pr-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.data.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 pr-4 font-medium">{r.rule_name}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline">
                          {conditionLabel[r.condition_type] || r.condition_type}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{r.threshold}</td>
                      <td className="py-3 pr-4 text-fg-muted">{r.window_seconds}s</td>
                      <td className="py-3 pr-4 text-fg-muted">{r.silence_seconds}s</td>
                      <td className="py-3 pr-4">{r.binding_count}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={r.enabled ? 'success' : 'secondary'}>
                          {r.enabled ? 'enabled' : 'disabled'}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-xs text-fg-muted">
                        {formatUnix(r.created_at)}
                      </td>
                      <td className="py-3 pr-2 text-right">
                        <RowMenu
                          items={[
                            { label: '编辑', onClick: () => openEdit(r) },
                            {
                              label: r.enabled ? '禁用' : '启用',
                              onClick: () => toggleMutation.mutate(r),
                            },
                            {
                              label: '删除',
                              danger: true,
                              onClick: () => setDeleteTarget(r),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {formOpen && (
        <AlertRuleForm
          key={editing?.id ?? 'create'}
          open={formOpen}
          onOpenChange={setFormOpen}
          rule={editing}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`删除规则 ${deleteTarget?.rule_name}？`}
        description="关联的绑定会被一并解除。操作不可撤销。"
        variant="destructive"
        confirmText="删除"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}