/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
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
        // 核心色彩体系 - 深色主题
        bg: 'var(--color-bg)',
        'bg-elevated': 'var(--color-bg-elevated)',
        'bg-muted': 'var(--color-bg-muted)',
        card: 'var(--color-card)',
        'card-hover': 'var(--color-card-hover)',
        
        // 边框
        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        input: 'var(--color-border)',
        ring: 'var(--color-accent)',
        
        // 文字层级
        fg: 'var(--color-fg)',
        'fg-muted': 'var(--color-fg-muted)',
        'fg-subtle': 'var(--color-fg-subtle)',
        foreground: 'var(--color-fg)',
        
        // 强调色
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        
        // 语义色
        success: {
          DEFAULT: 'var(--color-success)',
          bg: 'var(--color-success-bg)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          bg: 'var(--color-warning-bg)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          bg: 'var(--color-danger-bg)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          bg: 'var(--color-info-bg)',
        },
        
        // shadcn/ui 兼容
        background: 'var(--color-bg)',
        primary: {
          DEFAULT: 'var(--color-fg)',
          foreground: 'var(--color-bg)',
        },
        secondary: {
          DEFAULT: 'var(--color-bg-muted)',
          foreground: 'var(--color-fg)',
        },
        muted: {
          DEFAULT: 'var(--color-bg-muted)',
          foreground: 'var(--color-fg-muted)',
        },
        destructive: {
          DEFAULT: 'var(--color-danger)',
          foreground: 'var(--color-fg)',
        },
        
        // 悬停背景
        hover: 'var(--color-bg-muted)',
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
      boxShadow: {
        'sm-card': '0 1px 2px 0 rgb(0 0 0 / 0.1)',
        card: '0 1px 3px 0 rgb(0 0 0 / 0.15), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.2), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        menu: '0 4px 16px -2px rgb(0 0 0 / 0.25), 0 2px 6px -1px rgb(0 0 0 / 0.15)',
      },
    },
  },
  plugins: [],
};
