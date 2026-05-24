import type { HttpMethod } from '@/types/api-console';

export interface ApiClientRequest {
  method: HttpMethod;
  url: string;
  token?: string;
  body?: unknown;
}

export async function apiClient({ method, url, token, body }: ApiClientRequest) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    data,
  };
}
