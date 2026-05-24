import { NextResponse } from 'next/server';

const WINDOW_MS = 60_000;
const LIMIT = 120;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export const dynamic = 'force-dynamic';

function getClientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

function isRateLimited(clientKey: string) {
  const now = Date.now();
  const current = requestCounts.get(clientKey);

  if (!current || current.resetAt <= now) {
    requestCounts.set(clientKey, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (current.count >= LIMIT) {
    return true;
  }

  current.count += 1;
  requestCounts.set(clientKey, current);
  return false;
}

export async function POST(request: Request) {
  const clientKey = getClientKey(request);

  if (isRateLimited(clientKey)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = (await request.json()) as { type?: string; payload?: unknown };
    console.log(
      JSON.stringify({
        type: body.type ?? 'unknown',
        payload: body.payload ?? null,
        clientKey,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
