import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { createModel } from './ai.js';
import type { AIModelConfig, AnalysisConfig, GlobalConfig } from '../types/config.js';
import type { AIModel } from '../ai/models.js';

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
  '**/*.html'
];

// Maximum file size to analyze (in bytes)
const MAX_FILE_SIZE = 100 * 1024; // 100KB


interface CodeAnalysisResult {
  critical: string[];
  warnings: string[];
  suggestions: string[];
  fileSpecificIssues: Record<string, {
    critical: string[];
    warnings: string[];
    suggestions: string[];
  }>;
}

/**
 * Calculate priority score for a file based on various factors
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
 * Check if a file should be ignored based on patterns
 */
function shouldIgnoreFile(filePath: string, ignorePatterns: string[]): boolean {
  const relativePath = path.relative(process.cwd(), filePath);
  return ignorePatterns.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\//g, '\\/'));
    return regex.test(relativePath);
  });
}

/**
 * Check if a file should be included based on patterns
 */
function shouldIncludeFile(filePath: string, includePatterns: string[]): boolean {
  const relativePath = path.relative(process.cwd(), filePath);
  return includePatterns.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\//g, '\\/'));
    return regex.test(relativePath);
  });
}

/**
 * Recursively find all files in a directory that match the given patterns
 */
function findFiles(dir: string, config: AnalysisConfig): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  let results: string[] = [];
  const list = fs.readdirSync(dir);
  const ignorePatterns = config.ignore || [];
  const includePatterns = config.include || DEFAULT_INCLUDE_PATTERNS;

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    // Skip ignored directories and files
    if (shouldIgnoreFile(filePath, ignorePatterns)) {
      continue;
    }

    if (stat.isDirectory()) {
      results = results.concat(findFiles(filePath, config));
    } else if (
      shouldIncludeFile(filePath, includePatterns) &&
      stat.size <= (config.maxFileSize || MAX_FILE_SIZE)
    ) {
      results.push(filePath);
    }
  }

  return results;
}

/**
 * Read a file and return its contents
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
 * Group files by type for more focused analysis
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
 * Analyze a group of files
 */
async function analyzeFileGroup(
  groupName: string,
  files: string[],
  model: AIModel,
  config: AnalysisConfig & GlobalConfig,
  lighthouseContext?: { metrics: string; analysis: string }
): Promise<{ critical: string[], warnings: string[], suggestions: string[], fileIssues: Record<string, { critical: string[], warnings: string[], suggestions: string[] }> }> {
  if (files.length === 0) {
    return { critical: [], warnings: [], suggestions: [], fileIssues: {} };
  }

  const spinner = config.verbose ? ora(`Analyzing ${groupName} files...`).start() : null;

  // Prepare file contents for analysis
  const fileContents: Record<string, string> = {};
  let totalSize = 0;

  // Sort files by size (smallest first) to maximize the number of files we can analyze
  const sortedFiles = [...files].sort((a, b) => {
    return fs.statSync(a).size - fs.statSync(b).size;
  });

  // Only take files up to the configured limits
  const filesToAnalyze: string[] = [];
  for (const file of sortedFiles) {
    const content = readFileContent(file);
    const size = content.length;

    // Check if adding this file would exceed our limits
    if (totalSize + size <= (model.getConfig().maxTokens || 100000) && // Token limit
        filesToAnalyze.length < (config.batchSize || 20) && // File count limit
        size <= (config.maxFileSize || MAX_FILE_SIZE)) { // Individual file size limit
      fileContents[file] = content;
      filesToAnalyze.push(file);
      totalSize += size;
    } else if (size > (config.maxFileSize || MAX_FILE_SIZE)) {
      if (spinner) spinner.stop();
      console.log(chalk.yellow(`\nSkipping ${path.relative(process.cwd(), file)} (${Math.round(size / 1024)}KB) - exceeds size limit of ${Math.round((config.maxFileSize || 100 * 1024) / 1024)}KB`));
      if (spinner) spinner.start();
    }
  }

  if (spinner) {
    spinner.text = `Analyzing ${filesToAnalyze.length} ${groupName} files (${Math.round(totalSize / 1024)}KB)...`;
  }

  // Print out the specific files being sent to the AI
  if (config.verbose) {
    if (spinner) spinner.stop();
    console.log(chalk.blue.bold(`\nAnalyzing ${groupName} files:`));
    filesToAnalyze.forEach((file, index) => {
      const relativePath = path.relative(process.cwd(), file);
      const fileSize = Math.round(fileContents[file].length / 1024);
      console.log(`  ${index + 1}. ${chalk.cyan(relativePath)} (${fileSize}KB)`);
    });
    if (spinner) spinner.start();
  }

  // Create analysis prompt
  const prompt = `You are a performance optimization expert specializing in frontend web development.
I need you to analyze the following ${groupName} files for performance issues and optimization opportunities.

${lighthouseContext ? `
LIGHTHOUSE CONTEXT:
Performance Metrics:
${lighthouseContext.metrics}

Analysis:
${lighthouseContext.analysis}

Use the above Lighthouse insights to guide your code analysis. Look for specific code patterns that might be causing the performance issues identified by Lighthouse.
` : ''}

Here are the ONLY files you can reference in your analysis:
${filesToAnalyze.map(file => {
  const relativePath = path.relative(process.cwd(), file);
  const content = fileContents[file];
  const lineCount = content.split('\n').length;
  return `${relativePath} (${lineCount} lines)`;
}).join('\n')}

For each file, here is its content:

${filesToAnalyze.map(file => {
  const relativePath = path.relative(process.cwd(), file);
  const content = fileContents[file];
  const lines = content.split('\n');
  return `=== ${relativePath} ===
${lines.map((line, index) => `${index + 1}: ${line}`).join('\n')}

`;
}).join('\n')}

IMPORTANT - You MUST follow these rules:
1. ONLY reference the files listed above
2. Line numbers MUST exist in the file (check the line numbers shown above)
3. When referencing code, include 2-3 lines before and after for context
4. NEVER mention files or line numbers that don't exist
5. NEVER make assumptions about code you cannot see
6. If you're not 100% certain about a performance issue, DO NOT include it

Format your response EXACTLY as follows for each issue:

[CRITICAL/WARNING/SUGGESTION] <filepath>:<start_line>-<end_line>
Description: <clear description of the issue>
Impact: <specific performance impact>
Code Context:
\`\`\`
<exact code from the file>
\`\`\`
Solution: <specific, actionable solution with code example>
Expected Improvement: <quantified improvement estimate based on the actual code>

Example:
🚨 src/components/Header.tsx:45-48
Description: Memory leak in useEffect due to missing cleanup of event listener
Impact: Causes memory usage to grow over time, leading to degraded performance
Code Context:
\`\`\`tsx
useEffect(() => {
  window.addEventListener('resize', handleResize);
  // Missing cleanup
}, []);
\`\`\`
Solution: Add cleanup function to useEffect:
\`\`\`tsx
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
\`\`\`
Expected Improvement: Prevents memory leak of ~1KB per resize event listener

CRITICAL issues should use 🚨
WARNING issues should use ⚠️
SUGGESTION issues should use 💡

Each issue MUST be separated by exactly two newlines.
The first line of each issue MUST start with one of these emojis followed by a space and the filepath:line-range.
The filepath MUST be relative to the project root.
The line range MUST be in the format start-end (e.g., 45-48).
The Description, Impact, Code Context, Solution, and Expected Improvement sections MUST be on separate lines.
The Code Context section MUST be wrapped in triple backticks with the language specified.

Focus on these performance aspects:
- Render performance (unnecessary re-renders, expensive calculations)
- Bundle size (large dependencies, code splitting opportunities)
- Memory leaks and inefficient memory usage
- Network performance (excessive API calls, inefficient data fetching)
- CSS performance (complex selectors, layout thrashing)
- JavaScript performance (inefficient algorithms, unnecessary work)
- Asset optimization (images, fonts, etc.)`;

  try {
    const systemPrompt = "You are a performance optimization expert for frontend web applications. You MUST only reference files and line numbers that actually exist in the provided code. Never make assumptions about code you cannot see.";
    const analysisText = await model.generateSuggestions(prompt, { systemPrompt });

    // Parse issues with improved regex patterns that validate line numbers
    const parseIssues = (text: string, symbol: string): string[] => {
      const pattern = new RegExp(
        `${symbol}\\s+([^\\n]+?):(\\d+)-(\\d+)\\s*\\n` +   // Filepath and line range
        `Description:\\s*([^\\n]+)\\s*\\n` +                // Description
        `Impact:\\s*([^\\n]+)\\s*\\n` +                     // Impact
        `Code Context:\\s*\`\`\`[^\\n]*\\n([\\s\\S]+?)\`\`\`\\s*\\n` + // Code context
        `Solution:\\s*([\\s\\S]+?)\\n` +                    // Solution (can be multiline)
        `Expected Improvement:\\s*([^\\n]+)`,               // Expected Improvement
        'g'
      );

      const issues: string[] = [];
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const [_, filepath, startLine, endLine, description, impact, codeContext, solution, improvement] = match;

        // Validate the file exists and line numbers are valid
        const absolutePath = path.resolve(process.cwd(), filepath);
        if (!fileContents[absolutePath]) {
          console.log(chalk.yellow(`Warning: Skipping issue for non-existent file: ${filepath}`));
          continue;
        }

        const lineCount = fileContents[absolutePath].split('\n').length;
        if (parseInt(startLine) > lineCount || parseInt(endLine) > lineCount) {
          console.log(chalk.yellow(`Warning: Skipping issue with invalid line numbers in ${filepath}: ${startLine}-${endLine} (file has ${lineCount} lines)`));
          continue;
        }

        const formattedIssue =
          `${symbol} ${filepath}:${startLine}-${endLine}\n` +
          `**Description:** ${description.trim()}\n` +
          `**Impact:** ${impact.trim()}\n` +
          `**Code Context:**\n\`\`\`\n${codeContext.trim()}\n\`\`\`\n` +
          `**Solution:** ${solution.trim()}\n` +
          `**Expected Improvement:** ${improvement.trim()}`;
        issues.push(formattedIssue);
      }

      return issues;
    };

    const critical = parseIssues(analysisText, '🚨');
    const warnings = parseIssues(analysisText, '⚠️');
    const suggestions = parseIssues(analysisText, '💡');

    // Track issues by file
    const fileIssues: Record<string, { critical: string[], warnings: string[], suggestions: string[] }> = {};

    // Initialize fileIssues for each file
    filesToAnalyze.forEach(file => {
      fileIssues[file] = {
        critical: [],
        warnings: [],
        suggestions: []
      };
    });

    // Helper function to associate issues with files
    const associateIssuesWithFiles = (issues: string[], type: 'critical' | 'warnings' | 'suggestions') => {
      issues.forEach(issue => {
        const fileMatch = issue.match(/^[🚨⚠️💡]\s+([^:]+):/);
        if (fileMatch) {
          const relativePath = fileMatch[1];
          const absolutePath = path.resolve(process.cwd(), relativePath);
          if (fileIssues[absolutePath]) {
            fileIssues[absolutePath][type].push(issue);
          }
        }
      });
    };

    // Associate issues with files
    associateIssuesWithFiles(critical, 'critical');
    associateIssuesWithFiles(warnings, 'warnings');
    associateIssuesWithFiles(suggestions, 'suggestions');

    if (spinner) spinner.succeed(`Analyzed ${filesToAnalyze.length} ${groupName} files`);

    return {
      critical,
      warnings,
      suggestions,
      fileIssues
    };
  } catch (error) {
    if (spinner) spinner.fail(`Error analyzing ${groupName} files`);
    console.error(error);
    return { critical: [], warnings: [], suggestions: [], fileIssues: {} };
  }
}

/**
 * Process files in batches with prioritization
 */
async function processBatchedFiles(
  files: string[],
  config: AnalysisConfig & GlobalConfig,
  model: AIModel,
  lighthouseContext?: { metrics: string; analysis: string }
): Promise<CodeAnalysisResult> {
  const result: CodeAnalysisResult = {
    critical: [],
    warnings: [],
    suggestions: [],
    fileSpecificIssues: {}
  };

  // Calculate priority for each file
  const filePriorities = files.map(file => ({
    path: file,
    size: fs.statSync(file).size,
    score: calculateFilePriority(file, fs.statSync(file).size)
  }));

  // Sort by priority score (highest first)
  filePriorities.sort((a, b) => b.score - a.score);

  // Take only the maximum allowed files
  const filesToProcess = filePriorities
    .slice(0, config.maxFiles || 200)
    .map(fp => fp.path);

  // Group files by type
  const fileGroups = groupFilesByType(filesToProcess);

  // Process each group in batches
  for (const [groupName, groupFiles] of Object.entries(fileGroups)) {
    if (groupFiles.length === 0) continue;

    const batches = [];
    for (let i = 0; i < groupFiles.length; i += (config.batchSize || 20)) {
      batches.push(groupFiles.slice(i, i + (config.batchSize || 20)));
    }

    const spinner = config.verbose ? ora(`Processing ${groupName} files in ${batches.length} batches...`).start() : null;

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
          console.log(`  ${index + 1}. ${chalk.cyan(relativePath)} (${fileSize}KB) - Priority: ${priority}`);
        });
        if (spinner) spinner.start();
      }

      const batchResults = await analyzeFileGroup(groupName, batches[i], model, config, lighthouseContext);

      // Merge results
      result.critical.push(...batchResults.critical);
      result.warnings.push(...batchResults.warnings);
      result.suggestions.push(...batchResults.suggestions);

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
 * Analyze the entire codebase for performance issues
 */
export async function analyzeCodebase(config: AnalysisConfig & {
  lighthouseContext?: {
    metrics: string;
    analysis: string;
  };
  ai?: AIModelConfig;
} & GlobalConfig): Promise<CodeAnalysisResult> {
  const spinner = config.verbose ? ora('Finding files to analyze...').start() : null;

  // Determine the directory to scan
  const baseDir = config.targetDir
    ? path.resolve(process.cwd(), config.targetDir)
    : process.cwd();

  // Verify the directory exists
  if (!fs.existsSync(baseDir)) {
    if (spinner) spinner.fail(`Target directory does not exist: ${baseDir}`);
    throw new Error(`Target directory does not exist: ${baseDir}`);
  }

  // Find all files to analyze
  const allFiles = findFiles(baseDir, config);

  if (spinner) {
    spinner.succeed(`Found ${allFiles.length} files to analyze in ${path.relative(process.cwd(), baseDir) || '.'}`);
  }

  // Print summary of files found
  if (config.verbose) {
    console.log(chalk.blue.bold('\nFiles found by type:'));
    const filesByExt = allFiles.reduce((acc, file) => {
      const ext = path.extname(file);
      acc[ext] = (acc[ext] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(filesByExt).forEach(([ext, count]) => {
      console.log(`${chalk.yellow(ext)}: ${count} files`);
    });

    if (allFiles.length > (config.maxFiles || 200)) {
      console.log(chalk.yellow(`\nNote: Found ${allFiles.length} files, but will only analyze the ${config.maxFiles || 200} highest priority files.`));
    }
  }

  // Create AI model instance
  const model = createModel(config.ai || { provider: 'openai', model: 'o3-mini' });

  // Process files in batches with prioritization
  return processBatchedFiles(allFiles, config, model, config.lighthouseContext);
}
