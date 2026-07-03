import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import fg from 'fast-glob';
import ora from 'ora';
import Anthropic from '@anthropic-ai/sdk';
import { createModel } from './ai.js';
import type { AIModelConfig, AnalysisConfig } from '../types/config.js';
import type { AIClient } from '../ai/client.js';
import { PromptManager } from '../prompts/promptManager.js';
import { PROMPT_KEYS } from '../prompts/promptConfig.js';
import { validateFindings, findingToMarkdown, type Finding } from '../ai/schema.js';
import { AnalysisCache } from '../ai/cache.js';
import { runAgentAnalysis } from '../ai/agent.js';

// Default file patterns to include if none specified
const DEFAULT_INCLUDE_PATTERNS = [
  '**/*.js',
  '**/*.jsx',
  '**/*.ts',
  '**/*.tsx',
  '**/*.vue',
  '**/*.svelte',
  '**/*.astro',
  '**/*.css',
  '**/*.scss',
  '**/*.less',
  '**/*.sass',
  '**/*.html',
];

// Maximum file size to analyze (in bytes)
const MAX_FILE_SIZE = 100 * 1024; // 100KB

// Maximum combined content size per AI request (in characters)
const MAX_BATCH_CHARS = 100_000;

interface CodeAnalysisResult {
  critical: string[];
  warnings: string[];
  suggestions: string[];
  findings: Finding[];
  fileSpecificIssues: Record<
    string,
    {
      critical: string[];
      warnings: string[];
      suggestions: string[];
    }
  >;
}

interface LighthouseContext {
  metrics: string;
  analysis: {
    coreWebVitals: string;
    performanceOpportunities: string;
    diagnostics: string;
  };
}

interface CodeAnalysisConfig extends AnalysisConfig {
  lighthouseContext?: LighthouseContext;
  ai?: AIModelConfig;
  verbose?: boolean;
  noCache?: boolean;
}

/**
 * Calculates a priority score for a file based on various factors like file type, location, and size
 * @param {string} filePath - The path to the file
 * @param {number} size - The size of the file in bytes
 * @returns {number} A priority score (higher is better)
 */
function calculateFilePriority(filePath: string, size: number): number {
  let score = 0;

  // Prioritize entry points and important files
  if (filePath.includes('index.') || filePath.includes('main.')) score += 10;
  if (filePath.includes('app.') || filePath.includes('App.')) score += 8;

  // Prioritize component files
  if (filePath.includes('/components/')) score += 5;
  if (filePath.includes('/pages/')) score += 5;

  // Prioritize smaller files as they're more likely to fit in batches
  score += Math.max(0, 10 - Math.floor(size / 10240)); // Higher score for files under 10KB

  // Prioritize certain file types
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) score += 3;
  if (filePath.endsWith('.ts') || filePath.endsWith('.js')) score += 2;
  if (filePath.endsWith('.css') || filePath.endsWith('.scss')) score += 1;

  return score;
}

/**
 * Finds all files in a directory that match the include patterns and none of
 * the ignore patterns.
 * @param {string} dir - The directory to search in
 * @param {AnalysisConfig} config - Configuration for file analysis
 * @returns {string[]} Array of absolute file paths
 */
function findFiles(dir: string, config: AnalysisConfig): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fg
    .sync(config.include || DEFAULT_INCLUDE_PATTERNS, {
      cwd: dir,
      ignore: config.ignore || [],
      onlyFiles: true,
      dot: false,
      absolute: true,
    })
    .filter(file => fs.statSync(file).size <= (config.maxFileSize || MAX_FILE_SIZE));
}

/**
 * Reads and returns the contents of a file
 * @param {string} filePath - The path to the file
 * @returns {string} The contents of the file
 */
function readFileContent(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return '';
  }
}

/**
 * Groups files by their type for more focused analysis
 * @param {string[]} files - Array of file paths
 * @returns {Record<string, string[]>} Object mapping file types to arrays of file paths
 */
function groupFilesByType(files: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {
    react: [],
    vue: [],
    svelte: [],
    astro: [],
    javascript: [],
    typescript: [],
    styles: [],
    html: [],
  };

  for (const file of files) {
    const ext = path.extname(file);

    if (file.includes('.jsx') || file.includes('.tsx') || file.includes('react')) {
      groups.react.push(file);
    } else if (ext === '.vue') {
      groups.vue.push(file);
    } else if (ext === '.svelte') {
      groups.svelte.push(file);
    } else if (ext === '.astro') {
      groups.astro.push(file);
    } else if (ext === '.ts' || ext === '.tsx') {
      groups.typescript.push(file);
    } else if (ext === '.js' || ext === '.jsx') {
      groups.javascript.push(file);
    } else if (['.css', '.scss', '.less', '.sass'].includes(ext)) {
      groups.styles.push(file);
    } else if (ext === '.html') {
      groups.html.push(file);
    }
  }

  return groups;
}

/**
 * Builds the stable Lighthouse context string shared by every batch prompt.
 * It sits in the cached system prefix, so keep it byte-identical across calls.
 */
export function buildLighthouseContext(lighthouseContext?: LighthouseContext): string | undefined {
  if (!lighthouseContext) return undefined;
  return `LIGHTHOUSE CONTEXT

Performance Metrics:
${lighthouseContext.metrics}

Core Web Vitals:
${lighthouseContext.analysis.coreWebVitals}

Performance Opportunities:
${lighthouseContext.analysis.performanceOpportunities}

Diagnostics:
${lighthouseContext.analysis.diagnostics}

Use these Lighthouse insights to guide your code analysis. Look for the specific code patterns causing the performance issues identified above.`;
}

/**
 * Turns validated findings into the report's string buckets, grouped by severity
 * and by file.
 */
function bucketFindings(
  findings: Finding[],
  relativeToAbsolute: Record<string, string>
): {
  critical: string[];
  warnings: string[];
  suggestions: string[];
  findings: Finding[];
  fileIssues: Record<string, { critical: string[]; warnings: string[]; suggestions: string[] }>;
} {
  const buckets = {
    findings,
    critical: [] as string[],
    warnings: [] as string[],
    suggestions: [] as string[],
    fileIssues: {} as Record<
      string,
      { critical: string[]; warnings: string[]; suggestions: string[] }
    >,
  };
  const severityToBucket = {
    critical: 'critical',
    warning: 'warnings',
    suggestion: 'suggestions',
  } as const;

  for (const finding of findings) {
    const markdown = findingToMarkdown(finding);
    const bucket = severityToBucket[finding.severity];
    buckets[bucket].push(markdown);

    const absolutePath = relativeToAbsolute[finding.file];
    if (absolutePath) {
      buckets.fileIssues[absolutePath] ??= { critical: [], warnings: [], suggestions: [] };
      buckets.fileIssues[absolutePath][bucket].push(markdown);
    }
  }

  return buckets;
}

/**
 * Analyzes a group of files for performance issues using structured outputs
 * @param {string} groupName - The name of the file group (e.g., 'react', 'vue')
 * @param {string[]} files - Array of file paths to analyze
 * @param {AIClient} model - The AI client for analysis
 * @param {CodeAnalysisConfig} config - Configuration for analysis
 * @param {AnalysisCache} cache - Result cache keyed by batch content
 * @returns Analysis results bucketed by severity and by file
 */
async function analyzeFileGroup(
  groupName: string,
  files: string[],
  model: AIClient,
  config: CodeAnalysisConfig,
  cache: AnalysisCache
): Promise<{
  critical: string[];
  warnings: string[];
  suggestions: string[];
  findings: Finding[];
  fileIssues: Record<string, { critical: string[]; warnings: string[]; suggestions: string[] }>;
}> {
  if (files.length === 0) {
    return { critical: [], warnings: [], suggestions: [], findings: [], fileIssues: {} };
  }

  const spinner = config.verbose ? ora(`Analyzing ${groupName} files...`).start() : null;

  // Prepare file contents for analysis, keyed by relative path
  const fileContents: Record<string, string> = {};
  const relativeToAbsolute: Record<string, string> = {};
  let totalSize = 0;

  // Sort files by size (smallest first) to maximize the number of files we can analyze
  const sortedFiles = [...files].sort((a, b) => fs.statSync(a).size - fs.statSync(b).size);

  for (const file of sortedFiles) {
    const content = readFileContent(file);
    const size = content.length;
    const relativePath = path.relative(process.cwd(), file);

    if (
      totalSize + size <= MAX_BATCH_CHARS &&
      Object.keys(fileContents).length < (config.batchSize || 20) &&
      size <= (config.maxFileSize || MAX_FILE_SIZE)
    ) {
      fileContents[relativePath] = content;
      relativeToAbsolute[relativePath] = file;
      totalSize += size;
    } else if (size > (config.maxFileSize || MAX_FILE_SIZE)) {
      if (spinner) spinner.stop();
      console.log(
        chalk.yellow(
          `\nSkipping ${relativePath} (${Math.round(size / 1024)}KB) - exceeds size limit of ${Math.round((config.maxFileSize || MAX_FILE_SIZE) / 1024)}KB`
        )
      );
      if (spinner) spinner.start();
    }
  }

  const relativePaths = Object.keys(fileContents);
  if (relativePaths.length === 0) {
    if (spinner) spinner.stop();
    return { critical: [], warnings: [], suggestions: [], findings: [], fileIssues: {} };
  }

  if (spinner) {
    spinner.text = `Analyzing ${relativePaths.length} ${groupName} files (${Math.round(totalSize / 1024)}KB)...`;
  }

  const promptManager = PromptManager.getInstance();
  const prompt = `${promptManager.getPrompt(PROMPT_KEYS.CODE_ANALYSIS)}

Here are the ONLY files you can reference in your analysis:
${relativePaths.map(file => `${file} (${fileContents[file].split('\n').length} lines)`).join('\n')}

For each file, here is its content:

${relativePaths
  .map(file => {
    const lines = fileContents[file].split('\n');
    return `=== ${file} ===\n${lines.map((line, index) => `${index + 1}: ${line}`).join('\n')}\n`;
  })
  .join('\n')}`;

  try {
    const cacheKey = cache.key(model.getConfig().model || '', fileContents);
    let findings = cache.get(cacheKey);
    const fromCache = findings !== undefined;

    if (!findings) {
      findings = await model.analyzeCode(prompt, {
        systemPrompt: promptManager.getPrompt(PROMPT_KEYS.PERFORMANCE_EXPERT),
        sharedContext: buildLighthouseContext(config.lighthouseContext),
      });
    }

    const fileLineCounts = Object.fromEntries(
      relativePaths.map(file => [file, fileContents[file].split('\n').length])
    );
    const { valid, dropped } = validateFindings(findings, fileLineCounts);

    if (dropped.length > 0 && config.verbose) {
      if (spinner) spinner.stop();
      console.log(
        chalk.yellow(`Dropped ${dropped.length} finding(s) referencing non-existent files or lines`)
      );
      if (spinner) spinner.start();
    }

    if (!fromCache) {
      cache.set(cacheKey, valid);
    }

    if (spinner) {
      spinner.succeed(
        `Analyzed ${relativePaths.length} ${groupName} files${fromCache ? ' (cached)' : ''}`
      );
    }

    return bucketFindings(valid, relativeToAbsolute);
  } catch (error) {
    if (spinner) spinner.fail(`Error analyzing ${groupName} files`);
    // Auth/billing/request errors won't succeed on retry — stop the scan instead
    // of failing the same way on every remaining batch.
    if (error instanceof Anthropic.APIError && [400, 401, 403].includes(error.status ?? 0)) {
      throw new Error(`Anthropic API error: ${error.message}`);
    }
    console.error(error instanceof Error ? error.message : error);
    return { critical: [], warnings: [], suggestions: [], findings: [], fileIssues: {} };
  }
}

/**
 * Processes files in batches for analysis
 * @param {string[]} files - Array of file paths to analyze
 * @param {CodeAnalysisConfig} config - Configuration for analysis
 * @param {AIClient} model - The AI client for analysis
 * @param {AnalysisCache} cache - Result cache
 * @returns {Promise<CodeAnalysisResult>} Combined analysis results
 */
async function processBatchedFiles(
  files: string[],
  config: CodeAnalysisConfig,
  model: AIClient,
  cache: AnalysisCache
): Promise<CodeAnalysisResult> {
  const result: CodeAnalysisResult = {
    critical: [],
    warnings: [],
    suggestions: [],
    findings: [],
    fileSpecificIssues: {},
  };

  // Calculate priority for each file
  const filePriorities = files.map(file => ({
    path: file,
    size: fs.statSync(file).size,
    score: calculateFilePriority(file, fs.statSync(file).size),
  }));

  // Sort by priority score (highest first)
  filePriorities.sort((a, b) => b.score - a.score);

  // Take only the maximum allowed files
  const filesToProcess = filePriorities.slice(0, config.maxFiles || 200).map(fp => fp.path);

  // Group files by type
  const fileGroups = groupFilesByType(filesToProcess);

  // Process each group in batches
  for (const [groupName, groupFiles] of Object.entries(fileGroups)) {
    if (groupFiles.length === 0) continue;

    const batches = [];
    for (let i = 0; i < groupFiles.length; i += config.batchSize || 20) {
      batches.push(groupFiles.slice(i, i + (config.batchSize || 20)));
    }

    const spinner = config.verbose
      ? ora(`Processing ${groupName} files in ${batches.length} batches...`).start()
      : null;

    for (let i = 0; i < batches.length; i++) {
      if (spinner) {
        spinner.text = `Processing ${groupName} batch ${i + 1}/${batches.length}...`;
      }

      // Print files being analyzed in this batch
      if (config.verbose) {
        if (spinner) spinner.stop();
        console.log(chalk.blue.bold(`\nAnalyzing ${groupName} batch ${i + 1}:`));
        batches[i].forEach((file, index) => {
          const relativePath = path.relative(process.cwd(), file);
          const fileSize = Math.round(fs.statSync(file).size / 1024);
          const priority = filePriorities.find(fp => fp.path === file)?.score || 0;
          console.log(
            `  ${index + 1}. ${chalk.cyan(relativePath)} (${fileSize}KB) - Priority: ${priority}`
          );
        });
        if (spinner) spinner.start();
      }

      const batchResults = await analyzeFileGroup(groupName, batches[i], model, config, cache);

      // Merge results
      result.critical.push(...batchResults.critical);
      result.warnings.push(...batchResults.warnings);
      result.suggestions.push(...batchResults.suggestions);
      result.findings.push(...batchResults.findings);

      // Merge file-specific issues
      for (const [filePath, issues] of Object.entries(batchResults.fileIssues)) {
        result.fileSpecificIssues[filePath] = issues;
      }

      // Add delay between batches
      if (i < batches.length - 1) {
        if (spinner) {
          spinner.text = `Waiting ${config.batchDelay || 1000}ms before next batch...`;
        }
        await new Promise(resolve => setTimeout(resolve, config.batchDelay || 1000));
      }
    }

    if (spinner) spinner.succeed(`Completed analysis of ${groupName} files`);
  }

  return result;
}

/**
 * Analyzes the codebase for performance issues
 * @param {CodeAnalysisConfig} config - Configuration for codebase analysis
 * @returns {Promise<CodeAnalysisResult>} Complete analysis results including critical issues, warnings, and suggestions
 */
export async function analyzeCodebase(config: CodeAnalysisConfig): Promise<CodeAnalysisResult> {
  // Determine the directory to scan
  const baseDir = config.targetDir ? path.resolve(process.cwd(), config.targetDir) : process.cwd();

  if (!fs.existsSync(baseDir)) {
    throw new Error(`Target directory does not exist: ${baseDir}`);
  }

  const files = findFiles(baseDir, config);
  if (files.length === 0) {
    console.log(chalk.yellow('No files found to analyze.'));
    return { critical: [], warnings: [], suggestions: [], findings: [], fileSpecificIssues: {} };
  }

  if (config.verbose) {
    console.log(chalk.blue(`Found ${files.length} files to analyze`));
  }

  const model = createModel(config.ai);
  const cache = new AnalysisCache(process.cwd(), !config.noCache);

  return processBatchedFiles(files, config, model, cache);
}

/**
 * Agent-mode analysis: instead of batching every file into prompts, the model
 * investigates the codebase itself through tool use and reports findings.
 * @param {CodeAnalysisConfig} config - Same configuration as analyzeCodebase
 * @returns {Promise<CodeAnalysisResult>} Analysis results in the same report shape
 */
export async function analyzeCodebaseWithAgent(
  config: CodeAnalysisConfig
): Promise<CodeAnalysisResult> {
  const baseDir = config.targetDir ? path.resolve(process.cwd(), config.targetDir) : process.cwd();

  if (!fs.existsSync(baseDir)) {
    throw new Error(`Target directory does not exist: ${baseDir}`);
  }

  const model = createModel(config.ai);
  const promptManager = PromptManager.getInstance();

  console.log(chalk.blue.bold('\n🤖 Agent investigation'));
  const findings = await runAgentAnalysis(model, {
    targetDir: baseDir,
    ignore: config.ignore,
    maxFileSize: config.maxFileSize,
    systemPrompt: promptManager.getPrompt(PROMPT_KEYS.PERFORMANCE_EXPERT),
    lighthouseContext: buildLighthouseContext(config.lighthouseContext),
    verbose: config.verbose,
  });

  // Validate reported locations against the actual files on disk
  const fileLineCounts: Record<string, number> = {};
  const relativeToAbsolute: Record<string, string> = {};
  for (const finding of findings) {
    if (fileLineCounts[finding.file] !== undefined) continue;
    const absolutePath = path.resolve(baseDir, finding.file);
    const withinBase = absolutePath === baseDir || absolutePath.startsWith(baseDir + path.sep);
    if (withinBase && fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      fileLineCounts[finding.file] = readFileContent(absolutePath).split('\n').length;
      relativeToAbsolute[finding.file] = absolutePath;
    }
  }
  const { valid, dropped } = validateFindings(findings, fileLineCounts);
  if (dropped.length > 0) {
    console.log(
      chalk.yellow(`Dropped ${dropped.length} finding(s) referencing non-existent files or lines`)
    );
  }

  const buckets = bucketFindings(valid, relativeToAbsolute);
  return {
    critical: buckets.critical,
    warnings: buckets.warnings,
    suggestions: buckets.suggestions,
    findings: buckets.findings,
    fileSpecificIssues: buckets.fileIssues,
  };
}
