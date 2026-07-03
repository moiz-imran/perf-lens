import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Finding } from './schema.js';

/** Bump whenever prompts change in a way that should invalidate cached analyses. */
export const PROMPT_VERSION = 2;

const CACHE_FILE = '.perflens-cache.json';

/**
 * Result cache: content hash of a batch -> findings. Unchanged files cost
 * nothing on re-scan. Persisted as one JSON file in the project root (gitignored).
 */
// ponytail: whole-batch key; per-file caching if batch churn hurts hit rate
export class AnalysisCache {
  private entries: Record<string, Finding[]> = {};
  private readonly file: string;

  constructor(
    baseDir: string,
    private readonly enabled: boolean = true
  ) {
    this.file = path.join(baseDir, CACHE_FILE);
    if (enabled && fs.existsSync(this.file)) {
      try {
        this.entries = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
      } catch {
        this.entries = {};
      }
    }
  }

  key(model: string, fileContents: Record<string, string>): string {
    const hash = crypto.createHash('sha256');
    hash.update(`${model}\n${PROMPT_VERSION}\n`);
    for (const file of Object.keys(fileContents).sort()) {
      hash.update(file);
      hash.update('\0');
      hash.update(fileContents[file]);
      hash.update('\0');
    }
    return hash.digest('hex');
  }

  get(key: string): Finding[] | undefined {
    return this.enabled ? this.entries[key] : undefined;
  }

  set(key: string, findings: Finding[]): void {
    if (!this.enabled) return;
    this.entries[key] = findings;
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.entries));
    } catch {
      // cache persistence is best-effort
    }
  }
}
