import { useSyncExternalStore } from 'react';
import { pb } from './pb';

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

function readFromStore(): AuthUser | null {
  if (!pb.authStore.isValid) return null;
  const r = pb.authStore.record as Record<string, unknown> | null;
  if (!r) return null;
  return { id: String(r.id), email: String(r.email ?? ''), name: String(r.name ?? '') };
}

// getSnapshot 必须返回稳定引用：authStore.record 每次访问都会重新解析，不能直接返回
let current: AuthUser | null = readFromStore();
const listeners = new Set<() => void>();

pb.authStore.onChange(() => {
  current = readFromStore();
  listeners.forEach((fn) => fn());
});

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return current;
}

/** 登录态：内容来自 PocketBase 的 authStore，刷新页面也不会丢 */
export function useAuth() {
  const user = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return { user };
}

export async function login(email: string, password: string) {
  await pb.collection('users').authWithPassword(email.trim(), password);
}

export async function register(email: string, password: string, name: string) {
  await pb.collection('users').create({
    email: email.trim(),
    password,
    passwordConfirm: password,
    name: name.trim(),
  });
  await login(email, password);
}

export function logout() {
  pb.authStore.clear();
  current = null;
  listeners.forEach((fn) => fn());
}

/**
 * 所有同源请求自动带上登录 token：
 * PocketBase 自己的 /api 会自己带，这里补的是我们自己的 /ds-api。
 */
export function installAuthFetch() {
  const w = window as unknown as { __taskcardAuthFetch?: boolean };
  if (w.__taskcardAuthFetch) return;
  w.__taskcardAuthFetch = true;
  const raw = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (pb.authStore.isValid && (url.startsWith('/ds-api/') || url.startsWith('/api/'))) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has('authorization')) headers.set('authorization', `Bearer ${pb.authStore.token}`);
      return raw(input, { ...init, headers }).then((r) => {
        if (r.status === 401 && url.startsWith('/ds-api/')) {
          pb.authStore.clear();
          current = null;
          listeners.forEach((fn) => fn());
        }
        return r;
      });
    }
    return raw(input, init);
  };
}
