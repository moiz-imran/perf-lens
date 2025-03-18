import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

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

// Configure AWS SDK
const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  region: process.env.AWS_REGION,
});

// S3 bucket and key configuration
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const S3_KEYS = {
  [PROMPT_KEYS.LIGHTHOUSE_ANALYSIS]: process.env.LIGHTHOUSE_ANALYSIS_S3_KEY,
  [PROMPT_KEYS.CODE_ANALYSIS]: process.env.CODE_ANALYSIS_S3_KEY,
  [PROMPT_KEYS.PERFORMANCE_EXPERT]: process.env.PERFORMANCE_EXPERT_S3_KEY,
};

/**
 * Load a prompt template from the filesystem
 * @param filename The name of the template file
 * @returns The content of the template file
 */
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

/**
 * Fetch a prompt template from S3
 * @param key The S3 key for the template
 * @returns Promise resolving to the template content
 */
async function fetchS3Template(key: string): Promise<string> {
  if (!S3_BUCKET || !key) {
    console.warn('S3 bucket or key not configured properly.');
    return '';
  }

  try {
    const params = {
      Bucket: S3_BUCKET,
      Key: key,
    };

    const command = new GetObjectCommand(params);
    const response = await s3.send(command);

    // Convert the readable stream to string
    const bodyContents = await response.Body?.transformToString();
    return bodyContents || '';
  } catch (error) {
    console.error(`Error fetching template from S3: ${error}`);
    return '';
  }
}

/**
 * Get a prompt template by key, trying S3 first, then local file
 * @param key The prompt key
 * @returns Promise resolving to the prompt template
 */
export async function getPromptTemplateAsync(key: PromptKey): Promise<string> {
  // First try to fetch from S3
  const s3Key = S3_KEYS[key];
  if (s3Key) {
    const s3Template = await fetchS3Template(s3Key);
    if (s3Template) {
      return s3Template;
    }
  }

  // Fall back to local files if S3 fetch fails
  const localTemplates = {
    [PROMPT_KEYS.LIGHTHOUSE_ANALYSIS]: loadPromptTemplate('lighthouse-analysis.txt'),
    [PROMPT_KEYS.CODE_ANALYSIS]: loadPromptTemplate('code-analysis.txt'),
    [PROMPT_KEYS.PERFORMANCE_EXPERT]: loadPromptTemplate('performance-expert.txt'),
  };

  return localTemplates[key] || '';
}

/**
 * Get a prompt template by key synchronously (from local files only)
 * @param key The prompt key
 * @returns The prompt template
 */
export function getPromptTemplateSync(key: PromptKey): string {
  const localTemplates = {
    [PROMPT_KEYS.LIGHTHOUSE_ANALYSIS]: loadPromptTemplate('lighthouse-analysis.txt'),
    [PROMPT_KEYS.CODE_ANALYSIS]: loadPromptTemplate('code-analysis.txt'),
    [PROMPT_KEYS.PERFORMANCE_EXPERT]: loadPromptTemplate('performance-expert.txt'),
  };

  return localTemplates[key] || '';
}

export const DEFAULT_PROMPTS: Record<PromptKey, string> = {
  [PROMPT_KEYS.LIGHTHOUSE_ANALYSIS]: getPromptTemplateSync(PROMPT_KEYS.LIGHTHOUSE_ANALYSIS),
  [PROMPT_KEYS.CODE_ANALYSIS]: getPromptTemplateSync(PROMPT_KEYS.CODE_ANALYSIS),
  [PROMPT_KEYS.PERFORMANCE_EXPERT]: getPromptTemplateSync(PROMPT_KEYS.PERFORMANCE_EXPERT),
};
