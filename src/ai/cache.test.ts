import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AnalysisCache } from './cache.js';
import type { Finding } from './schema.js';

const FINDINGS: Finding[] = [
  {
    file: 'a.ts',
    startLine: 1,
    endLine: 2,
    severity: 'warning',
    title: 't',
    description: 'd',
    impact: 'i',
    solution: 's',
  },
];

describe('AnalysisCache', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perflens-cache-'));
  });

  it('produces a stable key for identical inputs', () => {
    const cache = new AnalysisCache(dir);
    const files = { 'a.ts': 'const x = 1;' };
    expect(cache.key('m', files)).toBe(cache.key('m', files));
  });

  it('changes the key when content or model changes', () => {
    const cache = new AnalysisCache(dir);
    const base = cache.key('m', { 'a.ts': 'const x = 1;' });
    expect(cache.key('m', { 'a.ts': 'const x = 2;' })).not.toBe(base);
    expect(cache.key('other-model', { 'a.ts': 'const x = 1;' })).not.toBe(base);
  });

  it('is insensitive to file insertion order', () => {
    const cache = new AnalysisCache(dir);
    expect(cache.key('m', { 'a.ts': '1', 'b.ts': '2' })).toBe(
      cache.key('m', { 'b.ts': '2', 'a.ts': '1' })
    );
  });

  it('round-trips findings through persistence', () => {
    const cache = new AnalysisCache(dir);
    const key = cache.key('m', { 'a.ts': 'x' });
    cache.set(key, FINDINGS);

    const reloaded = new AnalysisCache(dir);
    expect(reloaded.get(key)).toEqual(FINDINGS);
  });

  it('returns undefined on a miss and when disabled', () => {
    const cache = new AnalysisCache(dir);
    const key = cache.key('m', { 'a.ts': 'x' });
    expect(cache.get(key)).toBeUndefined();

    const disabled = new AnalysisCache(dir, false);
    disabled.set(key, FINDINGS);
    expect(disabled.get(key)).toBeUndefined();
    expect(new AnalysisCache(dir).get(key)).toBeUndefined();
  });
});
