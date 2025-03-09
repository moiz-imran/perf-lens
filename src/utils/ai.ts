import fs from 'fs';
import path from 'path';
import os from 'os';

// Configuration paths
const CONFIG_DIR = path.join(os.homedir(), '.perf-lens');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface Config {
  openaiApiKey?: string;
}

/**
 * Ensures the configuration directory exists
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Gets the current configuration
 */
function getConfig(): Config {
  try {
    ensureConfigDir();
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error reading config:', error);
  }
  return {};
}

/**
 * Saves the configuration to disk
 */
function saveConfig(config: Config): void {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config:', error);
    throw new Error('Failed to save configuration');
  }
}

/**
 * Sets the OpenAI API key in the configuration
 */
export function setApiKey(key: string): void {
  const config = getConfig();
  config.openaiApiKey = key;
  saveConfig(config);
}

/**
 * Gets the OpenAI API key from environment variable or configuration
 */
export function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || getConfig().openaiApiKey;
}