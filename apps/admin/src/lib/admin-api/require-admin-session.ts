'use client';

import { bootstrapAdminSession } from './admin-auth-client';
import {
  clearAdminSession,
  readAdminSession,
  writeAdminSession,
  type StoredAdminSession,
} from '@/lib/storage/admin-session';

export async function requireAdminSession() {
  const stored = readAdminSession();
  if (!stored) {
    throw new Error('admin_session_missing');
  }

  try {
    const nextSession = await bootstrapAdminSession(stored);
    writeAdminSession(nextSession);
    return nextSession satisfies StoredAdminSession;
  } catch (error) {
    clearAdminSession();
    throw error;
  }
}
