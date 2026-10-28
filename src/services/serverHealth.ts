import { execFile, type ExecException } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';

export interface ServerHealthTarget {
  alias: string;
  name: string;
  host: string;
  role: string;
  provider?: string;
  note?: string;
}

export type ServerHealthResult = {
  target: ServerHealthTarget;
  online: true;
  hostname: string;
  uptimeSeconds: number;
  load: [number, number, number];
  cores: number;
  memTotal: number;
  memAvailable: number;
  diskTotal: number;
  diskUsed: number;
} | {
  target: ServerHealthTarget;
  online: false;
  error: string;
};

const TARGETS_PATH = resolve(process.cwd(), 'data/server-health-targets.json');
const SSH_TIMEOUT_MS = 8_000;
const SSH_KEY_PATH = '/root/.ssh/notinews_health_ed25519';
const execFileAsync = promisify(execFile);
const REMOTE_COMMAND = [
  'set -euo pipefail',
  'hostname=$(hostname)',
  "uptime=$(cut -d' ' -f1 /proc/uptime)",
  "load=$(cut -d' ' -f1-3 /proc/loadavg)",
  'cores=$(nproc)',
  `mem=$(free -b | awk '/^Mem:/{print $2" "$7}')`,
  `disk=$(df -B1 --output=size,used / | awk 'NR==2{print $1" "$2}')`,
  'printf \'%s\\n\' "hostname=$hostname" "uptime_seconds=$uptime" "load=$load" "cores=$cores" "mem=$mem" "disk=$disk"',
].join('\n');

const numericField = z.string().trim().regex(/^\d+(?:\.\d+)?$/).transform(Number).pipe(z.number().nonnegative());
const integerField = numericField.pipe(z.number().int().nonnegative());
const positiveIntegerField = integerField.pipe(z.number().positive());
const remoteFieldsSchema = z.strictObject({
  hostname: z.string().trim().min(1),
  uptime_seconds: numericField,
  load: z.string().trim().transform(value => value.split(/\s+/)).pipe(z.tuple([numericField, numericField, numericField])),
  cores: positiveIntegerField,
  mem: z.string().trim().transform(value => value.split(/\s+/)).pipe(z.tuple([positiveIntegerField, integerField])),
  disk: z.string().trim().transform(value => value.split(/\s+/)).pipe(z.tuple([positiveIntegerField, integerField])),
}).refine(value => value.mem[1] <= value.mem[0] && value.disk[1] <= value.disk[0], {
  message: 'Server memory or disk usage exceeds its total.',
});

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
        REMOTE_COMMAND
      ],
      {
        encoding: 'utf-8',
        timeout: SSH_TIMEOUT_MS,
        killSignal: 'SIGKILL'
      }
    ));
  } catch (error) {
    const sshError = error as ExecException;
    if (sshError.code !== 255 && sshError.code !== 'ETIMEDOUT' && sshError.signal !== 'SIGKILL') throw error;
    return {
      target,
      online: false,
      error: normalizeSshError(error as ExecException)
    };
  }

  const fields = remoteFieldsSchema.parse(Object.fromEntries(stdout.trim().split('\n').map(line =>
    z.tuple([z.string().min(1), z.string()]).parse(line.split('=')),
  )));
  return {
    target,
    online: true,
    hostname: fields.hostname,
    uptimeSeconds: fields.uptime_seconds,
    load: fields.load,
    cores: fields.cores,
    memTotal: fields.mem[0],
    memAvailable: fields.mem[1],
    diskTotal: fields.disk[0],
    diskUsed: fields.disk[1],
  };
}

export async function checkServerHealth(): Promise<ServerHealthResult[]> {
  const targets = loadServerHealthTargets();
  return Promise.all(targets.map(probeServer));
}
