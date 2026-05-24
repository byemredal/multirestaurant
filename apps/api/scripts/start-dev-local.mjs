import { execFileSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';

const appRoot = resolve(import.meta.dirname, '..');

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(resolve(appRoot, '.env'));
}

const port = Number(process.env.PORT || 4000);

function getListeningPids(targetPort) {
  try {
    if (process.platform === 'win32') {
      const output = execFileSync('cmd.exe', ['/c', `netstat -ano | findstr :${targetPort}`], {
        encoding: 'utf8',
      });

      return output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.includes('LISTENING'))
        .map((line) => line.split(/\s+/).at(-1))
        .filter(Boolean)
        .filter((pid, index, array) => array.indexOf(pid) === index);
    }

    const output = execFileSync('lsof', ['-ti', `tcp:${targetPort}`], {
      encoding: 'utf8',
    });

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((pid, index, array) => array.indexOf(pid) === index);
  } catch {
    return [];
  }
}

function killPid(pid) {
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }

  process.kill(Number(pid), 'SIGTERM');
}

if (process.platform === 'win32') {
  for (const pid of getListeningPids(port)) {
    if (Number(pid) !== process.pid) {
      try {
        killPid(pid);
      } catch {
        // Best-effort port cleanup for local dev.
      }
    }
  }
} else {
  for (const pid of getListeningPids(port)) {
    if (Number(pid) !== process.pid) {
      console.log(`Stopping existing listener on port ${port} (pid ${pid})...`);
      try {
        killPid(pid);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Could not stop pid ${pid}: ${message}`);
      }
    }
  }
}

const nestBinary = resolve(
  appRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'nest.cmd' : 'nest',
);

const child =
  process.platform === 'win32'
    ? spawn(nestBinary, ['start', '--watch'], {
        cwd: appRoot,
        stdio: 'inherit',
        env: process.env,
        shell: true,
      })
    : spawn(nestBinary, ['start', '--watch'], {
        cwd: appRoot,
        stdio: 'inherit',
        env: process.env,
      });

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
