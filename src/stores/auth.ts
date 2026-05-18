import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/types/api';

/**
 * AuthState：当前会话的 token + user 信息。
 *
 * 持久化策略：localStorage（key = 'iot-scheduler-auth'），刷新页面不掉登录。
 * 安全权衡：localStorage 容易被 XSS 窃取，但本系统是内网管理控制台 + 严格 CSP（P1），
 * 取 UX 优先（HttpOnly cookie 需要后端额外接入 SameSite/CSRF 防护）。
 *
 * 过期处理：API 拦截器在 401 时调用 logout()，触发跳转 /login。
 */
interface AuthState {
  token: string | null;
  user: User | null;
  expires_at: number; // Unix 秒
  setSession: (token: string, user: User, expires_at: number) => void;
  logout: () => void;
  /** 计算属性：token 存在且未过期 */
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      expires_at: 0,
      setSession: (token, user, expires_at) => set({ token, user, expires_at }),
      logout: () => set({ token: null, user: null, expires_at: 0 }),
      isAuthenticated: () => {
        const { token, expires_at } = get();
        return !!token && expires_at > Math.floor(Date.now() / 1000);
      },
    }),
    {
      name: 'iot-scheduler-auth',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
