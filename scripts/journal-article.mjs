#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const apiPath = '/api/automation/articles';
const requestTimeoutMs = 30_000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class CliError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CliError';
    this.uncertain = options.uncertain === true;
  }
}

function usage() {
  return [
    '用法：journal-article create --input <JSON文件路径>',
    '      journal-article create --input -',
    '      journal-article --help',
    '',
    '说明：',
    '  create  创建一篇 Journal 文章，JSON 字段与服务端一致。',
    '  --input  UTF-8 JSON 文件路径；使用 - 时从标准输入读取。',
    '  --help   显示本说明。',
  ].join('\n');
}

function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new CliError(`缺少环境变量 ${name}。`);
  }
  return value;
}

function parseApiBaseUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new CliError('JOURNAL_API_URL 必须是有效的 HTTPS 站点根地址。');
  }
  if (url.protocol === 'https:') {
    // 继续校验。
  } else {
    throw new CliError('JOURNAL_API_URL 必须是有效的 HTTPS 站点根地址。');
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new CliError('JOURNAL_API_URL 不能包含用户名或密码。');
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new CliError('JOURNAL_API_URL 不能包含 query 或 fragment。');
  }
  if (url.pathname === '/' || url.pathname === '') {
    return url;
  }
  throw new CliError('JOURNAL_API_URL 必须是站点根地址，不能包含路径。');
}

async function readInput(path) {
  if (path === '-') {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  return readFile(path, 'utf8');
}

function parseInput(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`输入 JSON 无法解析：${message}`);
  }
  if (value === null) {
    throw new CliError('输入 JSON 顶层必须是对象。');
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      throw new CliError('输入 JSON 顶层必须是对象。');
    }
    return value;
  }
  throw new CliError('输入 JSON 顶层必须是对象。');
}

function assertAbsoluteUrl(value, field) {
  if (typeof value === 'string') {
    try {
      new URL(value);
      return;
    } catch {
      throw new CliError(`响应字段 ${field} 不是有效 URL。`);
    }
  }
  throw new CliError(`响应字段 ${field} 不是有效 URL。`);
}

function assertResponse(value) {
  if (value === null) {
    throw new CliError('Journal API 响应不是对象。');
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      throw new CliError('Journal API 响应不是对象。');
    }
  } else {
    throw new CliError('Journal API 响应不是对象。');
  }

  const { id, publicId, title, visibility, editorUrl, readerUrl } = value;
  if (Number.isInteger(id) === false || id <= 0) {
    throw new CliError('Journal API 响应中的 id 不是正整数。');
  }
  if (typeof publicId === 'string' && uuidPattern.test(publicId)) {
    // 继续。
  } else {
    throw new CliError('Journal API 响应中的 publicId 不是 UUID。');
  }
  if (typeof title === 'string') {
    // 继续。
  } else {
    throw new CliError('Journal API 响应中的 title 不是字符串。');
  }
  if (visibility === 'private' || visibility === 'public') {
    // 继续。
  } else {
    throw new CliError('Journal API 响应中的 visibility 无效。');
  }
  assertAbsoluteUrl(editorUrl, 'editorUrl');
  assertAbsoluteUrl(readerUrl, 'readerUrl');
}

async function requestArticle(input, baseUrl, token) {
  const url = new URL(apiPath, baseUrl);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
      redirect: 'error',
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`请求 Journal API 失败：${message}`, { uncertain: true });
  }

  const responseText = await response.text();
  if (response.status === 201) {
    let value;
    try {
      value = JSON.parse(responseText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Journal API 返回 HTTP 201，但响应不是有效 JSON：${message}`, { uncertain: true });
    }
    try {
      assertResponse(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Journal API 返回 HTTP 201，但响应不符合约定：${message}`, { uncertain: true });
    }
    return value;
  }

  const uncertain = response.status >= 500;
  throw new CliError(`Journal API 返回 HTTP ${response.status}：${responseText}`, { uncertain });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
    return;
  }
  if (args[0] === '--help') {
    if (args.length > 1) {
      throw new CliError('--help 不接受额外参数。');
    }
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (args[0] === 'create') {
    const parsed = parseArgs({
      args: args.slice(1),
      options: {
        input: { type: 'string' },
        help: { type: 'boolean' },
      },
      allowPositionals: false,
      strict: true,
    });
    if (parsed.values.help === true) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    const inputPath = parsed.values.input;
    if (inputPath === undefined) {
      throw new CliError('create 需要 --input <JSON文件路径|->。');
    }
    const apiBaseUrl = parseApiBaseUrl(requireEnv('JOURNAL_API_URL'));
    const token = requireEnv('JOURNAL_ARTICLE_TOKEN');
    const text = await readInput(inputPath);
    const input = parseInput(text);
    const result = await requestArticle(input, apiBaseUrl, token);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  throw new CliError(`未知子命令：${args[0]}`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const uncertain = error instanceof CliError && error.uncertain === true;
  process.stderr.write(`journal-article: ${message}\n`);
  if (uncertain) {
    process.stderr.write('写入结果可能不确定，请先确认服务端状态，不要自动重试。\n');
  }
  process.exitCode = 1;
}
