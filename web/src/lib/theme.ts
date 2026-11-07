import { useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'taskcard:theme';

export const THEME_LABEL: Record<ThemeMode, string> = {
  system: '随系统',
  light: '浅色',
  dark: '深色',
};

export function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* 无痕模式里 localStorage 可能不可用 */
  }
  return 'system';
}

function systemDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
}

export function resolvedTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return systemDark() ? 'dark' : 'light';
  return mode;
}

let swapTimer: number | undefined;

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const theme = resolvedTheme(mode);
  // 换肤瞬间关掉所有过渡，避免背景/文字在两种颜色之间“闪”一下
  root.classList.add('theme-swap');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0e0e0d' : '#ffffff');
  window.clearTimeout(swapTimer);
  swapTimer = window.setTimeout(() => root.classList.remove('theme-swap'), 240);
}

export function saveMode(mode: ThemeMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* 忽略 */
  }
  applyTheme(mode);
}

/** 读当前模式；system 模式下跟随系统变化实时切换。 */
export function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(readMode);

  useEffect(() => {
    applyTheme(mode);
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const change = (m: ThemeMode) => {
    setMode(m);
    saveMode(m);
  };

  return [mode, change];
}

export const THEME_CYCLE: ThemeMode[] = ['system', 'light', 'dark'];
