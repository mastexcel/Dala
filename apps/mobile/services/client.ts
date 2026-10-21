import { API_URL, USE_MOCKS } from './config';
import { ApiError } from './errors';
import { mockRequest } from './mock/handlers';
import { useAuthStore } from '@/stores/auth';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** PIN de confirmation (authentification forte, Art. 84). */
  pin?: string;
  auth?: boolean;
}

function buildPath(path: string, query?: RequestOptions['query']) {
  if (!query) return path;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${path}?${qs}` : path;
}

async function rawRequest<T>(path: string, opts: RequestOptions, token: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token && opts.auth !== false) headers.Authorization = `Bearer ${token}`;
  if (opts.pin) headers['x-transaction-pin'] = opts.pin;
  const fullPath = buildPath(path, opts.query);

  if (USE_MOCKS) return mockRequest<T>(opts.method ?? 'GET', fullPath, opts.body, headers);

  const res = await fetch(`${API_URL}/v1${fullPath}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Erreur serveur', data.code, data.details);
  return data as T;
}

let refreshing: Promise<boolean> | null = null;

/** Requête authentifiée avec renouvellement transparent du jeton d'accès. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  try {
    return await rawRequest<T>(path, opts, accessToken);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || opts.auth === false) throw e;
    refreshing ??= useAuthStore.getState().refresh().finally(() => {
      refreshing = null;
    });
    if (!(await refreshing)) throw e;
    return rawRequest<T>(path, opts, useAuthStore.getState().accessToken);
  }
}

export function exportUrl(path: string, query: Record<string, string>) {
  return `${API_URL}/v1${buildPath(path, query)}`;
}
