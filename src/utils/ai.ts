import OpenAI from "openai";
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.perf-lens');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface Config {
  openaiApiKey?: string;
}

function getConfig(): Config {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error reading config:', error);
  }
  return {};
}

function saveConfig(config: Config): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config:', error);
  }
}

export function setApiKey(key: string): void {
  const config = getConfig();
  config.openaiApiKey = key;
  saveConfig(config);
}

export function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || getConfig().openaiApiKey;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      resolve();
    }, ms);

    // Cleanup on rejection
    timer.unref?.(); // Optional cleanup for Node.js
  });
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let retries = 0;
  let currentDelay = initialDelay;
  let timer: NodeJS.Timeout | null = null;

  const cleanup = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  try {
    while (true) {
      try {
        return await fn();
      } catch (error) {
        if (error instanceof OpenAI.APIError && error.status === 429) {
          retries++;
          if (retries >= maxRetries) {
            throw error;
          }
          currentDelay = initialDelay * Math.pow(2, retries - 1);
          console.log(`Rate limited. Retrying in ${currentDelay}ms...`);
          await sleep(currentDelay);
          continue;
        }
        throw error;
      }
    }
  } finally {
    cleanup();
  }
}

export async function getAISuggestions(issues: string[]): Promise<string> {
  if (!issues || issues.length === 0) return "✅ No optimizations needed.";

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not found! Please set it using:\n" +
      "perf-lens config set-key YOUR_API_KEY\n" +
      "Or set the OPENAI_API_KEY environment variable."
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const prompt = `Briefly analyze these frontend performance issues and suggest key fixes (be concise):\n\n${issues.join("\n")}`;

    const completion = await retryWithBackoff(async () => {
      return await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "gpt-3.5-turbo",
        temperature: 0.5,
        max_tokens: 50,
        presence_penalty: -0.5
      });
    });

    return completion.choices[0].message.content || "No suggestions available.";
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        console.error("Rate limit details:", {
          status: error.status,
          message: error.message,
          type: error.type,
          code: error.code
        });
        return "⚠️ Rate limit reached after retries. Please wait a few minutes before trying again.";
      }
      throw new Error(`AI API Error: ${error.message} (Type: ${error.type}, Code: ${error.code})`);
    }
    throw error;
  }
}