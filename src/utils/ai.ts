import fs from 'fs';
import path from 'path';
import os from 'os';
import { AIModel, createAIModel } from '../ai/models.js';
import type { AIProvider, AIModelConfig } from '../types/config.js';

// Configuration paths
const CONFIG_DIR = path.join(os.homedir(), '.perf-lens');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_MODELS = {
  openai: 'o3-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  gemini: 'gemini-1.5-pro'
}

interface Config {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  aiConfig?: AIModelConfig;
}

/**
 * Ensures the configuration directory exists in the user's home directory
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Retrieves the current AI configuration from disk
 * @returns {Config} The current configuration object
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
 * Saves the AI configuration to disk
 * @param {Config} config - The configuration object to save
 * @throws {Error} If saving the configuration fails
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
 * Sets the API key for a specific AI provider
 * @param {string} key - The API key to set
 * @param {AIProvider} provider - The AI provider to set the key for
 * @throws {Error} If the provider is not supported
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
 * Gets the API key for a specific AI provider from environment variables or config file
 * @param {AIProvider} provider - The AI provider to get the key for
 * @returns {string | undefined} The API key if found, undefined otherwise
 * @throws {Error} If the provider is not supported
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
 * Creates an AI model instance based on the provided configuration
 * @param {AIModelConfig} config - The configuration for the AI model
 * @returns {AIModel} The created AI model instance
 * @throws {Error} If the API key is not found or the model creation fails
 */
export function createModel(config: AIModelConfig): AIModel {
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
 * Validates an API key for a specific AI provider by testing the connection
 * @param {string} key - The API key to validate
 * @param {AIProvider} provider - The AI provider to validate the key for
 * @returns {Promise<boolean>} True if the key is valid, false otherwise
 */
export async function validateApiKey(key: string, provider: AIProvider): Promise<boolean> {
  try {
    const model = createModel({
      provider,
      model: DEFAULT_MODELS[provider],
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