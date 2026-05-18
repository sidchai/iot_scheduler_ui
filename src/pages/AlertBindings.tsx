import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { alertApi, extractError } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { RowMenu } from '@/components/ui/row-menu';
import { useToast } from '@/components/ui/toast';
import { AlertBindingForm } from '@/components/AlertBindingForm';
import { formatUnix } from '@/lib/utils';
import type { AlertBinding } from '@/types/api';

/**
 * 告警绑定列表：把 job、rule、channel 三者关联起来。
 *
 * 评估器只扫描启用绑定；解绑后停止后续评估，但历史事件保留。
 */
export default function AlertBindingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [jobFilter, setJobFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AlertBinding | null>(null);

  const bindings = useQuery({
    queryKey: ['alertBindings', jobFilter],
    queryFn: () => alertApi.listBindings({ job_name: jobFilter || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => alertApi.unbind(id),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error || '解绑失败');
      qc.invalidateQueries({ queryKey: ['alertBindings'] });
      qc.invalidateQueries({ queryKey: ['alertRules'] });
      toast.success('已解绑');
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">告警绑定</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="按 job_name 过滤"
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="w-64"
          />
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> 新建绑定
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">共 {bindings.data?.length ?? 0} 条绑定</CardTitle>
        </CardHeader>
        <CardContent>
          {bindings.isLoading && <div className="text-sm text-fg-muted">加载中…</div>}
          {bindings.isError && (
            <div className="text-sm text-danger">加载失败：{extractError(bindings.error)}</div>
          )}
          {bindings.data && bindings.data.length === 0 && (
            <div className="rounded-md border border-dashed border-border py-12 text-center text-sm text-fg-muted">
              暂无绑定
            </div>
          )}
          {bindings.data && bindings.data.length > 0 && (
            <div>
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-fg-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">ID</th>
                    <th className="py-2 pr-4 font-medium">job_name</th>
                    <th className="py-2 pr-4 font-medium">规则</th>
                    <th className="py-2 pr-4 font-medium">通道</th>
                    <th className="py-2 pr-4 font-medium">状态</th>
                    <th className="py-2 pr-4 font-medium">创建</th>
                    <th className="w-20 py-2 pr-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {bindings.data.map((b) => (
                    <tr key={b.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 pr-4 font-mono text-xs">{b.id}</td>
                      <td className="py-3 pr-4 font-medium">{b.job_name}</td>
                      <td className="py-3 pr-4">
                        {b.rule_name} <span className="text-xs text-fg-muted">#{b.rule_id}</span>
                      </td>
                      <td className="py-3 pr-4">
                        {b.channel_name}{' '}
                        <span className="text-xs text-fg-muted">#{b.channel_id}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={b.enabled ? 'success' : 'secondary'}>
                          {b.enabled ? 'enabled' : 'disabled'}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-xs text-fg-muted">
                        {formatUnix(b.created_at)}
                      </td>
                      <td className="py-3 pr-2 text-right">
                        <RowMenu
                          items={[{ label: '解绑', danger: true, onClick: () => setDeleteTarget(b) }]}
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

      {formOpen && <AlertBindingForm open={formOpen} onOpenChange={setFormOpen} />}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`解绑 ${deleteTarget?.job_name}？`}
        description={`将断开 ${deleteTarget?.rule_name} 与 ${deleteTarget?.channel_name} 的告警通路。已生成的事件保留。`}
        variant="destructive"
        confirmText="解绑"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}