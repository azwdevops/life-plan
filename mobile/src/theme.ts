export const colors = {
  light: {
    background: '#ffffff',
    surface: '#f4f4f5',
    border: '#e4e4e7',
    text: '#18181b',
    textMuted: '#71717a',
    accent: '#7c3aed',
    secondary: '#1e90ff',
    danger: '#dc2626',
  },
  dark: {
    background: '#18181b',
    surface: '#27272a',
    border: '#3f3f46',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    accent: '#a78bfa',
    secondary: '#3b9eff',
    danger: '#f87171',
  },
};

export type ThemeColors = typeof colors.light;
