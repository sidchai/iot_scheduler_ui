import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { CalendarClock, LogIn } from 'lucide-react';
import { authApi, extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <div className="flex h-full items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600">
            <CalendarClock className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-fg">iot-scheduler</h1>
          <p className="mt-1 text-[13px] text-fg-muted">控制台登录</p>
        </div>

        {/* 登录卡片 */}
        <div className="ui-card p-6">
          <form className="space-y-5" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="username" className="text-fg">用户名</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="例如：admin"
                className="mt-2 h-11 bg-bg-elevated border-border text-fg placeholder:text-fg-subtle"
              />
            </div>
            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-[13px] text-danger">
                {error}
              </div>
            )}
            <Button 
              type="submit" 
              className="h-11 w-full bg-fg text-bg hover:bg-fg/90" 
              disabled={loginMutation.isPending}
            >
              <LogIn className="h-4 w-4" />
              {loginMutation.isPending ? '登录中...' : '登录'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-[12px] text-fg-subtle">
          开发模式：任意用户名均可登录，首次登录自动创建 viewer 角色
        </p>
        <p className="mt-2 text-center text-[12px] text-fg-subtle">
          提示：首次启动时系统会自动创建 <code className="rounded bg-bg-muted px-1.5 py-0.5 text-fg-muted">admin</code> 账号
        </p>
      </div>
    </div>
  );
}
