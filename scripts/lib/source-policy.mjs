import path from 'node:path';

const LIMITS = new Map([
  ['.rs', 300],
  ['.ts', 300],
  ['.tsx', 350],
  ['.css', 400],
]);

const EXCLUDED_SEGMENTS = new Set([
  'dist',
  'node_modules',
  'coverage',
  'out',
  'artifacts',
  'target',
  '.test-dist',
  '.coverage-dist',
  '.vscode-test',
  '.git',
]);

export function sourceLimit(file) {
  const normalized = file.replaceAll('\\', '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.some((part) => EXCLUDED_SEGMENTS.has(part))) {
    return null;
  }
  return LIMITS.get(path.extname(normalized)) ?? null;
}

export function countPhysicalLines(text) {
  if (text.length === 0) return 0;
  return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
}

export function looksArtificiallyCompressed(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  return lines.some((line) => line.length > 500 && (line.match(/[;{}]/g) ?? []).length >= 20);
}
