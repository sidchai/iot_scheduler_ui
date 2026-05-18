import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import { authApi, extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * 登录页：当前仅支持 dev 模式用户名登录。
 *
 * 真实 SSO 接入后，本页应改为 OAuth 授权入口，由后端处理 code 回调。
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const setSession = useAuthStore((s) => s.setSession);
  const [username, setUsername] = useState('admin');
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from || '/';
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const loginMutation = useMutation({
    mutationFn: () => authApi.ssoLogin({ provider: 'dev', code: username }),
    onSuccess: (data) => {
      setSession(data.access_token, data.user, data.expires_at);
      navigate(from, { replace: true });
    },
    onError: (err) => setError(extractError(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    loginMutation.mutate();
  };

  return (
    <div className="flex h-full items-center justify-center bg-hover/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">iot-scheduler 控制台</CardTitle>
          <CardDescription>
            开发模式：任意用户名均可登录，首次登录自动创建 viewer 角色
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="例如：admin"
              />
            </div>
            {error && (
              <div className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              <LogIn className="h-4 w-4" />
              {loginMutation.isPending ? '登录中…' : '登录'}
            </Button>
          </form>
          <p className="mt-4 text-xs text-fg-muted">
            提示：首次启动时系统会自动创建 <code className="rounded bg-hover px-1">admin</code>{' '}
            账号；用此名登录获得 admin 权限。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}