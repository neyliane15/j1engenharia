const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:3333';

const ACCESS_KEY = 'emptra.accessToken';
const REFRESH_KEY = 'emptra.refreshToken';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'ERROR',
    public details?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Rotas públicas (link do WhatsApp) não mandam Authorization. */
  auth?: boolean;
}

/** Evita uma corrida de vários refresh simultâneos quando o token expira. */
let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;

  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      tokenStore.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      // Libera para a próxima expiração.
      setTimeout(() => (refreshing = null), 0);
    }
  })();

  return refreshing;
}

async function request<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(auth && tokenStore.access ? { authorization: `Bearer ${tokenStore.access}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401 && auth && retry) {
    if (await refreshSession()) return request<T>(path, options, false);
    tokenStore.clear();
    if (!location.pathname.startsWith('/entrar') && !location.pathname.startsWith('/cotacao/')) {
      location.href = '/entrar';
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.message ?? 'Não foi possível concluir a operação', err.code, err.details);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
};

/**
 * Baixa um arquivo autenticado (XLSX). O <a download> puro não serve:
 * o endpoint exige o header Authorization.
 */
export async function downloadFile(path: string, fallbackName: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: tokenStore.access ? { authorization: `Bearer ${tokenStore.access}` } : {},
  });
  if (!res.ok) {
    const text = await res.text();
    let message = 'Não foi possível gerar o arquivo';
    try {
      message = JSON.parse(text)?.error?.message ?? message;
    } catch {
      /* resposta não-JSON */
    }
    throw new ApiError(res.status, message);
  }

  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = match?.[1] ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export { BASE_URL };
