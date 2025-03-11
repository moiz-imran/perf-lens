import fs from 'fs';
import path from 'path';
import os from 'os';
import { createAIModel } from '../ai/models.js';
import type { AIProvider, AIModelConfig } from '../types/config.js';

// Configuration paths
const CONFIG_DIR = path.join(os.homedir(), '.perf-lens');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface Config {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  aiConfig?: AIModelConfig;
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
 * Sets the API key for a specific provider
 */
export function setApiKey(key: string, provider: AIProvider): void {
  const config = getConfig();
  switch (provider) {
    case 'openai':
      config.openaiApiKey = key;
      break;
    case 'anthropic':
      config.anthropicApiKey = key;
      break;
    case 'gemini':
      config.geminiApiKey = key;
      break;
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
  saveConfig(config);
}

/**
 * Gets the API key for a specific provider
 */
export function getApiKey(provider: AIProvider): string | undefined {
  const config = getConfig();
  switch (provider) {
    case 'openai':
      return process.env.PERF_LENS_OPENAI_API_KEY || config.openaiApiKey;
    case 'anthropic':
      return process.env.PERF_LENS_ANTHROPIC_API_KEY || config.anthropicApiKey;
    case 'gemini':
      return process.env.PERF_LENS_GEMINI_API_KEY || config.geminiApiKey;
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Creates an AI model instance based on configuration
 */
export function createModel(config: AIModelConfig) {
  const apiKey = getApiKey(config.provider);
  if (!apiKey) {
    throw new Error(
      `API key not found for ${config.provider}! Please set it using:\n` +
      `perf-lens config set-key YOUR_API_KEY --provider ${config.provider}\n` +
      `Or set the ${config.provider.toUpperCase()}_API_KEY environment variable.`
    );
  }

  return createAIModel({
    ...config,
    apiKey
  });
}

/**
 * Validates the API key for a specific provider
 */
export async function validateApiKey(key: string, provider: AIProvider): Promise<boolean> {
  try {
    const model = createModel({
      provider,
      model: provider === 'openai' ? 'o3-mini' : provider === 'anthropic' ? 'claude-3-7-sonnet-20250219' : 'gemini-pro',
      apiKey: key
    });

    // Test the API key with a simple prompt
    await model.generateSuggestions('Test connection');
    return true;
  } catch (error) {
    console.error(`Error validating ${provider} API key:`, error);
    return false;
  }
}