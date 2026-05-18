/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // 与 RFC-05 原型一致：Inter 主字体 + JetBrains Mono 代码字体
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // ===== shadcn/ui 默认色板（保留，已被现有 ui/* 组件依赖） =====
        // border 对齐到 RFC-05 原型的 #E4E4E7（zinc-200），与 index.css 内联组件一致
        border: '#E4E4E7',
        input: '#E4E4E7',
        ring: 'hsl(222.2 84% 4.9%)',
        background: 'hsl(0 0% 100%)',
        foreground: 'hsl(222.2 84% 4.9%)',
        primary: {
          DEFAULT: 'hsl(222.2 47.4% 11.2%)',
          foreground: 'hsl(210 40% 98%)',
        },
        secondary: {
          DEFAULT: 'hsl(210 40% 96.1%)',
          foreground: 'hsl(222.2 47.4% 11.2%)',
        },
        muted: {
          DEFAULT: 'hsl(210 40% 96.1%)',
          foreground: 'hsl(215.4 16.3% 46.9%)',
        },
        destructive: {
          DEFAULT: 'hsl(0 84.2% 60.2%)',
          foreground: 'hsl(210 40% 98%)',
        },
        success: {
          DEFAULT: '#10B981',
          foreground: 'hsl(355.7 100% 97.3%)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          foreground: 'hsl(48 96% 89%)',
        },

        // ===== RFC-05 原型设计 token（docs/rfc/05_ui_prototype.html L20-L38） =====
        // 页面/卡片/文字层级
        bg: '#FAFAFA',
        card: '#FFFFFF',
        fg: '#09090B',
        'fg-muted': '#71717A',
        'fg-subtle': '#A1A1AA',
        // 边框增强 + 悬停背景
        'border-strong': '#D4D4D8',
        hover: '#F4F4F5',
        // 强调色（链接 / 信息）
        accent: '#2563EB',
        'accent-bg': '#EFF6FF',
        // 语义色彩底色（与 badge/dot 一致）
        'success-bg': '#ECFDF5',
        'warning-bg': '#FFFBEB',
        danger: '#EF4444',
        'danger-bg': '#FEF2F2',
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
      boxShadow: {
        // 原型自定义阴影：卡片 / 卡片 hover / 弹窗
        'sm-card': '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        card: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
        menu: '0 4px 16px -2px rgb(0 0 0 / 0.08), 0 2px 6px -1px rgb(0 0 0 / 0.04)',
      },
    },
  },
  plugins: [],
};
