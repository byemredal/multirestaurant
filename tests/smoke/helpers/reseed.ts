import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const SEED_SCRIPT = resolve(__dirname, '../../../apps/api/scripts/seed-smoke.mjs');

/**
 * Run the smoke seed script as a child process and resolve when it exits
 * cleanly. Used by tests that mutate DB state (admin approve flips Tenant
 * A's status, admin resend creates a TenantPasswordSetupToken) so each test
 * starts from a deterministic baseline regardless of the order Playwright
 * picks.
 */
export function reseedSmokeFixtures(): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [SEED_SCRIPT], {
      cwd: resolve(__dirname, '../../../apps/api'),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`seed-smoke exited with code ${code}: ${stderr.slice(0, 400)}`));
      }
    });
    child.on('error', reject);
  });
}
