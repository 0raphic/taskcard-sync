// 写操作口令：token 存在本机，所有改数据的请求自动带上 x-write-token。
// 服务端没开口令时这个头会被忽略，所以可以一直带着。

const KEY = 'taskcard:write-token';
const NEED_EVENT = 'taskcard:need-passcode';

export function getWriteToken(): string {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setWriteToken(token: string) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* 无痕模式忽略 */
  }
}

export function clearWriteToken() {
  setWriteToken('');
}

/** 装一次：让本页所有非 GET 的 same-origin fetch 自动带口令头，401 时弹口令框。 */
export function installWriteToken() {
  if (typeof window === 'undefined' || (window as { __wt?: boolean }).__wt) return;
  (window as { __wt?: boolean }).__wt = true;
  const raw = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const sameOrigin = url.startsWith('/') || url.startsWith(window.location.origin);
    if (sameOrigin && method !== 'GET' && method !== 'HEAD') {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      const token = getWriteToken();
      if (token) headers.set('x-write-token', token);
      init = { ...init, headers };
    }
    const res = await raw(input as RequestInfo, init);
    if (res.status === 401) {
      const body = await res.clone().json().catch(() => null);
      if (body?.need_passcode) window.dispatchEvent(new CustomEvent(NEED_EVENT));
    }
    return res;
  };
}

export function onNeedPasscode(handler: () => void) {
  const fn = () => handler();
  window.addEventListener(NEED_EVENT, fn);
  return () => window.removeEventListener(NEED_EVENT, fn);
}
