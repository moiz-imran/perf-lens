import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const PROMPT_KEYS = {
  LIGHTHOUSE_ANALYSIS: 'lighthouse_analysis',
  CODE_ANALYSIS: 'code_analysis',
  PERFORMANCE_EXPERT: 'performance_expert',
} as const;

export type PromptKey = (typeof PROMPT_KEYS)[keyof typeof PROMPT_KEYS];

export interface PromptData {
  key: PromptKey;
  content: string;
}

// Get the directory path of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadPromptTemplate(filename: string): string {
  const templatePath = path.join(__dirname, 'templates', filename);
  try {
    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `Template file not found: ${filename}\nExpected path: ${templatePath}\nPlease ensure the package was built correctly with 'npm run build'`
      );
    }
    return fs.readFileSync(templatePath, 'utf-8');
  } catch (error) {
    console.error(`Error loading prompt template ${filename}:`, error);
    console.error('Current directory:', __dirname);
    console.error('Template directory:', path.join(__dirname, 'templates'));
    throw error;
  }
}

export const DEFAULT_PROMPTS: Record<PromptKey, string> = {
  [PROMPT_KEYS.LIGHTHOUSE_ANALYSIS]: loadPromptTemplate('lighthouse-analysis.txt'),
  [PROMPT_KEYS.CODE_ANALYSIS]: loadPromptTemplate('code-analysis.txt'),
  [PROMPT_KEYS.PERFORMANCE_EXPERT]: loadPromptTemplate('performance-expert.txt'),
};
