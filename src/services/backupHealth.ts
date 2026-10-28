import { execFile, type ExecException } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import { bj } from '../utils/time.js';

export interface BackupHealthTarget {
  alias: string;
  name: string;
  host: string;
  serviceUnit: string;
  timerUnit: string;
}

export interface BackupHealthResult {
  target: BackupHealthTarget;
  healthy: boolean;
  timerState?: string;
  timerSubState?: string;
  serviceResult?: string;
  exitStatus?: string;
  exitAt?: string;
  error?: string;
}

const TARGETS_PATH = resolve(process.cwd(), 'data/backup-health-targets.json');
const ALERT_STATE_PATH = resolve(process.cwd(), 'data/backup-health-alert-state.json');
const SSH_TIMEOUT_MS = 8_000;
const SSH_KEY_PATH = '/root/.ssh/notinews_health_ed25519';
const BACKUP_TIME = '04:50:00';
const execFileAsync = promisify(execFile);

function loadBackupHealthTargets(): BackupHealthTarget[] {
  if (!existsSync(TARGETS_PATH)) {
    throw new Error(`Backup health targets file not found: ${TARGETS_PATH}`);
  }

  const targets = JSON.parse(readFileSync(TARGETS_PATH, 'utf-8')) as BackupHealthTarget[];
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('Backup health targets must be a non-empty array.');
  }

  return targets;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function buildRemoteCheckCommand(target: BackupHealthTarget): string {
  const serviceUnit = shellQuote(target.serviceUnit);
  const timerUnit = shellQuote(target.timerUnit);

  return [
    'set -euo pipefail',
    'today=$(TZ=Asia/Shanghai date +%F)',
    `expected_epoch=$(TZ=Asia/Shanghai date -d "$today ${BACKUP_TIME}" +%s)`,
    `timer_state=$(systemctl show --value --property=ActiveState ${timerUnit})`,
    `timer_substate=$(systemctl show --value --property=SubState ${timerUnit})`,
    `service_result=$(systemctl show --value --property=Result ${serviceUnit})`,
    `exit_status=$(systemctl show --value --property=ExecMainStatus ${serviceUnit})`,
    `exit_at=$(systemctl show --value --property=ExecMainExitTimestamp ${serviceUnit})`,
    'exit_day=$(TZ=Asia/Shanghai date -d "$exit_at" +%F 2>/dev/null || true)',
    'exit_epoch=$(TZ=Asia/Shanghai date -d "$exit_at" +%s 2>/dev/null || true)',
    'printf "%s\\n" "today=$today" "expected_epoch=$expected_epoch" "timer_state=$timer_state" "timer_substate=$timer_substate" "service_result=$service_result" "exit_status=$exit_status" "exit_at=$exit_at" "exit_day=$exit_day" "exit_epoch=$exit_epoch"',
  ].join('; ');
}

function parseRemoteFields(output: string): Record<string, string> {
  return Object.fromEntries(
    output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const separator = line.indexOf('=');
        return separator === -1
          ? [line, '']
          : [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function normalizeSshError(error: ExecException): string {
  if (error.signal === 'SIGKILL' || error.code === 'ETIMEDOUT') {
    return 'SSH 连接超时';
  }
  return error.stderr?.toString().trim().split('\n').at(-1) || error.message;
}

export async function collectBackupSystemdStatus(target: BackupHealthTarget): Promise<Record<string, string>> {
  const { stdout } = await execFileAsync(
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
      buildRemoteCheckCommand(target),
    ],
    {
      encoding: 'utf-8',
      timeout: SSH_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    },
  );
  return parseRemoteFields(stdout);
}

async function checkTarget(target: BackupHealthTarget): Promise<BackupHealthResult> {
  let fields: Record<string, string>;
  try {
    fields = await collectBackupSystemdStatus(target);
  } catch (error) {
    return {
      target,
      healthy: false,
      error: normalizeSshError(error as ExecException),
    };
  }

  const expectedEpoch = Number(fields.expected_epoch);
  const exitEpoch = Number(fields.exit_epoch);
  const issues: string[] = [];

  if (fields.timer_state !== 'active' || fields.timer_substate !== 'waiting') {
    issues.push(`定时器状态异常（${fields.timer_state || '未知'}/${fields.timer_substate || '未知'}）`);
  }

  if (fields.service_result !== 'success' || fields.exit_status !== '0') {
    issues.push(`服务结果异常（${fields.service_result || '未知'}，退出码 ${fields.exit_status || '未知'}）`);
  }

  if (
    !fields.exit_day
    || fields.exit_day !== fields.today
    || !Number.isFinite(expectedEpoch)
    || !Number.isFinite(exitEpoch)
    || exitEpoch < expectedEpoch
  ) {
    issues.push(`最近执行时间异常（${fields.exit_at || '未知'}）`);
  }

  return {
    target,
    healthy: issues.length === 0,
    timerState: fields.timer_state,
    timerSubState: fields.timer_substate,
    serviceResult: fields.service_result,
    exitStatus: fields.exit_status,
    exitAt: fields.exit_at,
    ...(issues.length > 0 ? { error: issues.join('；') } : {}),
  };
}

export async function checkBackupHealth(): Promise<BackupHealthResult[]> {
  return Promise.all(loadBackupHealthTargets().map(checkTarget));
}

const dashboardBackupFieldsSchema = z.object({
  timer_state: z.string().min(1),
  timer_substate: z.string().min(1),
  service_result: z.string().min(1),
  exit_status: z.string().regex(/^\d+$/),
  exit_at: z.string().min(1),
  exit_epoch: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()),
});

export async function checkDashboardBackupHealth(): Promise<BackupHealthResult[]> {
  const now = bj();
  const todayDeadline = now.startOf('day').hour(4).minute(50);
  const deadline = now.isBefore(todayDeadline) ? todayDeadline.subtract(1, 'day') : todayDeadline;
  return Promise.all(loadBackupHealthTargets().map(async target => {
    let rawFields: Record<string, string>;
    try {
      rawFields = await collectBackupSystemdStatus(target);
    } catch (error) {
      const sshError = error as ExecException;
      if (sshError.code !== 255 && sshError.code !== 'ETIMEDOUT' && sshError.signal !== 'SIGKILL') throw error;
      return {
        target,
        healthy: false,
        error: normalizeSshError(sshError),
      };
    }
    const fields = dashboardBackupFieldsSchema.parse(rawFields);
    const issues: string[] = [];
    if (fields.timer_state !== 'active' || fields.timer_substate !== 'waiting') {
      issues.push(`定时器状态异常（${fields.timer_state}/${fields.timer_substate}）`);
    }
    if (fields.service_result !== 'success' || fields.exit_status !== '0') {
      issues.push(`服务结果异常（${fields.service_result}，退出码 ${fields.exit_status}）`);
    }
    if (fields.exit_epoch < deadline.unix()) {
      issues.push(`最近执行时间异常（${fields.exit_at}）`);
    }
    return {
      target,
      healthy: issues.length === 0,
      timerState: fields.timer_state,
      timerSubState: fields.timer_substate,
      serviceResult: fields.service_result,
      exitStatus: fields.exit_status,
      exitAt: bj(new Date(fields.exit_epoch * 1000)).toISOString(),
      ...(issues.length > 0 ? { error: issues.join('；') } : {}),
    };
  }));
}

type BackupAlertState = Record<string, 'healthy' | 'failed'>;

function loadBackupAlertState(): BackupAlertState {
  if (!existsSync(ALERT_STATE_PATH)) return {};
  return JSON.parse(readFileSync(ALERT_STATE_PATH, 'utf-8')) as BackupAlertState;
}

export function getNewBackupFailures(results: BackupHealthResult[]): BackupHealthResult[] {
  const state = loadBackupAlertState();
  return results.filter(result => !result.healthy && state[result.target.alias] !== 'failed');
}

export function saveBackupAlertState(results: BackupHealthResult[]): void {
  const state: BackupAlertState = Object.fromEntries(
    results.map(result => [result.target.alias, result.healthy ? 'healthy' : 'failed']),
  );
  writeFileSync(ALERT_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}
