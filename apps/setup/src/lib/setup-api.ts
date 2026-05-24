import { apiBaseUrl } from './config';

export type SystemStateValue = 'UNINITIALIZED' | 'INITIALIZING' | 'READY';

export interface PlatformSummary {
  platformName: string;
  supportEmail: string;
  logoUrl: string | null;
  primaryCountry: string;
  initializedAt: string;
}

export interface SetupStatus {
  initialized: boolean;
  platform: PlatformSummary | null;
}

export interface InitializePayload {
  platformName: string;
  supportEmail: string;
  logoUrl?: string;
  primaryCountry: string;
  adminEmail: string;
  adminPassword: string;
  bootstrapKey: string;
}

/** Error with a stable `code` the UI can branch on for user-facing copy. */
export class SetupApiError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'SetupApiError';
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Pulls the backend error message out of the shared error envelope. */
function errorMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error?: unknown }).error;
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message?: unknown }).message ?? '');
    }
    if (typeof error === 'string') {
      return error;
    }
  }
  return '';
}

export async function getSystemState(): Promise<{ state: SystemStateValue }> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/system/state`, {
      method: 'GET',
      cache: 'no-store',
    });
  } catch {
    throw new SetupApiError('api_unreachable');
  }

  if (!response.ok) {
    throw new SetupApiError('state_failed');
  }

  const body = (await readJson(response)) as { state?: SystemStateValue } | null;
  return { state: body?.state ?? 'UNINITIALIZED' };
}

export async function getSetupStatus(): Promise<SetupStatus> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/setup/status`, {
      method: 'GET',
      cache: 'no-store',
    });
  } catch {
    throw new SetupApiError('api_unreachable');
  }

  if (!response.ok) {
    throw new SetupApiError('status_failed');
  }

  const body = (await readJson(response)) as Partial<SetupStatus> | null;
  return {
    initialized: Boolean(body?.initialized),
    platform: body?.platform ?? null,
  };
}

export async function initializePlatform(
  payload: InitializePayload,
): Promise<SetupStatus> {
  const { bootstrapKey, ...body } = payload;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/setup/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bootstrap-Key': bootstrapKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SetupApiError('api_unreachable');
  }

  if (response.ok) {
    const result = (await readJson(response)) as Partial<SetupStatus> | null;
    return {
      initialized: Boolean(result?.initialized),
      platform: result?.platform ?? null,
    };
  }

  const message = errorMessage(await readJson(response)).toLowerCase();

  if (response.status === 401) {
    throw new SetupApiError('invalid_bootstrap_key');
  }
  if (response.status === 403) {
    throw new SetupApiError(
      message.includes('bootstrap_key') || message.includes('bootstrap key')
        ? 'bootstrap_key_not_configured'
        : 'setup_disabled',
    );
  }
  if (response.status === 409) {
    throw new SetupApiError(
      message.includes('in progress')
        ? 'initialization_in_progress'
        : 'already_initialized',
    );
  }
  if (response.status === 400) {
    throw new SetupApiError('invalid_input');
  }
  if (response.status === 429) {
    throw new SetupApiError('rate_limited');
  }
  throw new SetupApiError('initialize_failed');
}
