import { execFile, type ExecException } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export interface ServerHealthTarget {
  alias: string;
  name: string;
  host: string;
  role: string;
  provider?: string;
  note?: string;
}

export interface ServerHealthResult {
  target: ServerHealthTarget;
  online: boolean;
  hostname?: string;
  uptime?: string;
  error?: string;
}

const TARGETS_PATH = resolve(process.cwd(), 'data/server-health-targets.json');
const SSH_TIMEOUT_MS = 8_000;
const SSH_KEY_PATH = '/root/.ssh/notinews_health_ed25519';
const execFileAsync = promisify(execFile);

function loadServerHealthTargets(): ServerHealthTarget[] {
  if (!existsSync(TARGETS_PATH)) {
    throw new Error(`Server health targets file not found: ${TARGETS_PATH}`);
  }

  const targets = JSON.parse(readFileSync(TARGETS_PATH, 'utf-8')) as ServerHealthTarget[];
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('Server health targets must be a non-empty array.');
  }

  return targets;
}

function normalizeSshError(error: ExecException): string {
  if (error.signal === 'SIGKILL' || error.code === 'ETIMEDOUT') {
    return 'SSH 连接超时';
  }
  return error.stderr?.toString().trim().split('\n').at(-1) || error.message;
}

async function probeServer(target: ServerHealthTarget): Promise<ServerHealthResult> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      'ssh',
      [
        '-i', SSH_KEY_PATH,
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'IdentitiesOnly=yes',
        '-o', 'PreferredAuthentications=publickey',
        '-o', 'GSSAPIAuthentication=no',
        '-o', 'ConnectionAttempts=1',
        '-o', `ConnectTimeout=${Math.floor(SSH_TIMEOUT_MS / 1000)}`,
        '-o', 'ServerAliveInterval=3',
        '-o', 'ServerAliveCountMax=1',
        '-o', 'LogLevel=ERROR',
        '-l', 'root',
        target.host,
        'hostname && uptime -p'
      ],
      {
        encoding: 'utf-8',
        timeout: SSH_TIMEOUT_MS,
        killSignal: 'SIGKILL'
      }
    ));
  } catch (error) {
    return {
      target,
      online: false,
      error: normalizeSshError(error as ExecException)
    };
  }

  const lines = stdout
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  return {
    target,
    online: true,
    hostname: lines[0] ?? target.alias,
    uptime: lines[1] ?? '未知'
  };
}

export async function checkServerHealth(): Promise<ServerHealthResult[]> {
  const targets = loadServerHealthTargets();
  return Promise.all(targets.map(probeServer));
}
