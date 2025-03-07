import OpenAI from "openai";
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

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

    // Group issues by type for better analysis
    const criticalIssues = issues.filter(i => i.includes('🚨'));
    const warnings = issues.filter(i => i.includes('⚠️'));
    const suggestions = issues.filter(i => i.includes('💡'));

    const prompt = `As a frontend performance expert, analyze these issues and provide specific, actionable improvements. Focus on the most impactful changes first.

Critical Issues:
${criticalIssues.join('\n')}

Warnings:
${warnings.join('\n')}

Suggestions:
${suggestions.join('\n')}

Provide a detailed analysis with:
1. High-Impact Changes: List the top 3-5 most critical issues that should be addressed first, with specific file locations and exact changes needed
2. Performance Impact: For each suggestion, explain the performance benefit (e.g., reduced bundle size, faster render times, better memory usage)
3. Implementation Guide: Provide specific code examples or patterns to follow
4. Quick Wins: Identify any simple changes that could provide immediate benefits
5. Long-term Improvements: Suggest architectural changes if needed

Be specific and actionable. Don't give generic advice. Reference specific files and components mentioned in the issues.`;

    const completion = await retryWithBackoff(async () => {
      return await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "gpt-3.5-turbo",
        temperature: 0.2, // Lower temperature for more focused responses
        max_tokens: 1000, // Increased token limit for detailed responses
        presence_penalty: 0 // Removed negative penalty to allow more comprehensive responses
      });
    });

    const response = completion.choices[0].message.content || "No suggestions available.";

    // Format the response with proper markdown
    return `# Performance Optimization Analysis

${response}

${chalk.gray('─'.repeat(50))}
${chalk.blue('ℹ️ Note:')} These suggestions are AI-generated based on static analysis. Always test changes in your specific context.`;

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