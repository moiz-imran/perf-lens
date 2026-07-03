import fs from 'fs';
import path from 'path';
import os from 'os';
import { AIClient } from '../ai/client.js';
import type { AIModelConfig } from '../types/config.js';

// Configuration paths
const CONFIG_DIR = path.join(os.homedir(), '.perf-lens');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface StoredConfig {
  anthropicApiKey?: string;
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readStoredConfig(): StoredConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error reading config:', error);
  }
  return {};
}

/**
 * Saves the Anthropic API key to ~/.perf-lens/config.json
 */
export function setApiKey(key: string): void {
  ensureConfigDir();
  const config = readStoredConfig();
  config.anthropicApiKey = key;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Resolves the Anthropic API key: PERF_LENS_ANTHROPIC_API_KEY, then
 * ANTHROPIC_API_KEY, then the saved config file.
 */
export function getApiKey(): string | undefined {
  return (
    process.env.PERF_LENS_ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    readStoredConfig().anthropicApiKey
  );
}

/**
 * Creates the AI client used for all analysis.
 * @throws {Error} If no API key is configured
 */
export function createModel(config: AIModelConfig = {}): AIClient {
  const apiKey = config.apiKey || getApiKey();
  if (!apiKey) {
    throw new Error(
      'Anthropic API key not found! Set it with:\n' +
        '  perf-lens config set-key YOUR_API_KEY\n' +
        'or set the ANTHROPIC_API_KEY environment variable.'
    );
  }
  return new AIClient({ ...config, apiKey });
}
