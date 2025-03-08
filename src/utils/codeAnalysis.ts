import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { OpenAI } from 'openai';
import { getApiKey } from './ai.js';

// File extensions to analyze
const EXTENSIONS_TO_ANALYZE = [
  '.js', '.jsx', '.ts', '.tsx',
  '.vue', '.svelte', '.astro',
  '.css', '.scss', '.less', '.sass',
  '.html'
];

// Maximum file size to analyze (in bytes)
const MAX_FILE_SIZE = 100 * 1024; // 100KB

// Maximum number of files to analyze
const MAX_FILES = 50;

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
 * Recursively find all files in a directory that match the given extensions
 */
function findFiles(dir: string, extensions: string[]): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  let results: string[] = [];
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    // Skip node_modules, .git, and other common directories to ignore
    if (stat.isDirectory()) {
      if (
        file !== 'node_modules' &&
        file !== '.git' &&
        file !== 'dist' &&
        file !== 'build' &&
        file !== 'out' &&
        file !== '.next' &&
        file !== '.nuxt' &&
        !file.startsWith('.')
      ) {
        results = results.concat(findFiles(filePath, extensions));
      }
    } else if (
      extensions.includes(path.extname(file)) &&
      stat.size <= MAX_FILE_SIZE
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
 * Analyze a group of files with the LLM
 */
async function analyzeFileGroup(
  groupName: string,
  files: string[],
  openai: OpenAI
): Promise<{ critical: string[], warnings: string[], suggestions: string[], fileIssues: Record<string, { critical: string[], warnings: string[], suggestions: string[] }> }> {
  if (files.length === 0) {
    return { critical: [], warnings: [], suggestions: [], fileIssues: {} };
  }

  const spinner = ora(`Analyzing ${groupName} files...`).start();

  // Prepare file contents for analysis
  const fileContents: Record<string, string> = {};
  let totalSize = 0;

  // Sort files by size (smallest first) to maximize the number of files we can analyze
  const sortedFiles = [...files].sort((a, b) => {
    return fs.statSync(a).size - fs.statSync(b).size;
  });

  // Only take files up to a reasonable size limit for the API
  const filesToAnalyze: string[] = [];
  for (const file of sortedFiles) {
    const content = readFileContent(file);
    const size = content.length;

    if (totalSize + size <= 100000 && filesToAnalyze.length < 20) { // 100KB limit, max 20 files
      fileContents[file] = content;
      filesToAnalyze.push(file);
      totalSize += size;
    }
  }

  spinner.text = `Analyzing ${filesToAnalyze.length} ${groupName} files (${Math.round(totalSize / 1024)}KB)...`;

  // Print out the specific files being sent to the AI
  spinner.stop();
  console.log(chalk.blue.bold(`\nSending to AI for ${groupName} analysis:`));
  filesToAnalyze.forEach((file, index) => {
    const relativePath = path.relative(process.cwd(), file);
    const fileSize = Math.round(fileContents[file].length / 1024);
    console.log(`  ${index + 1}. ${chalk.cyan(relativePath)} (${fileSize}KB)`);
  });
  spinner.start();

  // Create a detailed prompt for the LLM
  const prompt = `You are a performance optimization expert specializing in frontend web development.
I need you to analyze the following ${groupName} files for performance issues and optimization opportunities.

For each file, identify:
1. CRITICAL issues (🚨): Problems that significantly impact performance and should be fixed immediately
2. WARNINGS (⚠️): Issues that may cause performance problems under certain conditions
3. SUGGESTIONS (💡): Opportunities to improve performance that aren't urgent

Focus on these performance aspects:
- Render performance (unnecessary re-renders, expensive calculations in render)
- Bundle size (large dependencies, code splitting opportunities)
- Memory leaks and inefficient memory usage
- Network performance (excessive API calls, inefficient data fetching)
- CSS performance (complex selectors, layout thrashing)
- JavaScript performance (inefficient algorithms, unnecessary work)
- Asset optimization (images, fonts, etc.)

Be extremely specific in your analysis:
- Cite exact line numbers and code snippets
- Explain why each issue impacts performance
- Provide concrete, actionable solutions
- Quantify the impact where possible (e.g., "could reduce bundle size by ~20KB")

Here are the files to analyze:

${filesToAnalyze.map(file => {
  const relativePath = path.relative(process.cwd(), file);
  return `--- ${relativePath} ---\n${fileContents[file]}\n\n`;
}).join('')}

Format your response as follows:
1. First, provide a high-level summary of the most critical performance issues across all files
2. Then, for each file, list issues in order of severity (CRITICAL, WARNING, SUGGESTION)
3. For each issue, include:
   - Issue type (CRITICAL/WARNING/SUGGESTION)
   - Description of the problem
   - Exact location (line numbers)
   - Explanation of performance impact
   - Recommended solution with code example if applicable

IMPORTANT: For each issue, clearly indicate which file it belongs to by including the file path at the beginning of the issue description.

Only include genuine performance issues. If a file has good performance practices, acknowledge that.
Be thorough and detailed in your analysis.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a performance optimization expert for frontend web applications." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 4000,
    });

    const analysisText = response.choices[0]?.message?.content || '';

    // Parse the response to extract critical issues, warnings, and suggestions
    const critical = analysisText.match(/🚨.*?(?=\n\n|\n[^🚨]|$)/gs) || [];
    const warnings = analysisText.match(/⚠️.*?(?=\n\n|\n[^⚠️]|$)/gs) || [];
    const suggestions = analysisText.match(/💡.*?(?=\n\n|\n[^💡]|$)/gs) || [];

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
        // Try to find which file this issue belongs to
        for (const file of filesToAnalyze) {
          const relativePath = path.relative(process.cwd(), file);
          if (issue.includes(relativePath)) {
            fileIssues[file][type].push(issue);
            break;
          }
        }
      });
    };

    // Associate issues with files
    associateIssuesWithFiles(critical, 'critical');
    associateIssuesWithFiles(warnings, 'warnings');
    associateIssuesWithFiles(suggestions, 'suggestions');

    spinner.succeed(`Analyzed ${filesToAnalyze.length} ${groupName} files`);

    return {
      critical: critical.map(c => c.trim()),
      warnings: warnings.map(w => w.trim()),
      suggestions: suggestions.map(s => s.trim()),
      fileIssues
    };
  } catch (error) {
    spinner.fail(`Error analyzing ${groupName} files`);
    console.error(error);
    return { critical: [], warnings: [], suggestions: [], fileIssues: {} };
  }
}

/**
 * Analyze the entire codebase for performance issues
 */
export async function analyzeCodebase(): Promise<CodeAnalysisResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not found! Please set it using:\n" +
      "perf-lens config set-key YOUR_API_KEY\n" +
      "Or set the OPENAI_API_KEY environment variable."
    );
  }

  const openai = new OpenAI({ apiKey });
  const spinner = ora('Finding files to analyze...').start();

  // Find all files to analyze
  const allFiles = findFiles(process.cwd(), EXTENSIONS_TO_ANALYZE);

  // Limit the number of files to analyze
  const filesToAnalyze = allFiles.slice(0, MAX_FILES);

  spinner.succeed(`Found ${filesToAnalyze.length} files to analyze`);

  // Print out the list of files being analyzed
  console.log(chalk.blue.bold('\nFiles being analyzed:'));
  filesToAnalyze.forEach((file, index) => {
    const relativePath = path.relative(process.cwd(), file);
    console.log(`${index + 1}. ${chalk.cyan(relativePath)}`);
  });
  console.log(); // Add an empty line for better readability

  // Group files by type
  const fileGroups = groupFilesByType(filesToAnalyze);

  // Print out files by group
  console.log(chalk.blue.bold('Files grouped by type:'));
  for (const [groupName, files] of Object.entries(fileGroups)) {
    if (files.length > 0) {
      console.log(chalk.yellow(`\n${groupName.toUpperCase()} (${files.length} files):`));
      files.forEach((file, index) => {
        const relativePath = path.relative(process.cwd(), file);
        console.log(`  ${index + 1}. ${chalk.cyan(relativePath)}`);
      });
    }
  }
  console.log(); // Add an empty line for better readability

  // Analyze each group of files
  const result: CodeAnalysisResult = {
    critical: [],
    warnings: [],
    suggestions: [],
    fileSpecificIssues: {}
  };

  for (const [groupName, files] of Object.entries(fileGroups)) {
    if (files.length === 0) continue;

    const groupResults = await analyzeFileGroup(groupName, files, openai);

    result.critical.push(...groupResults.critical);
    result.warnings.push(...groupResults.warnings);
    result.suggestions.push(...groupResults.suggestions);

    // Add file-specific issues directly from the analysis results
    for (const [filePath, issues] of Object.entries(groupResults.fileIssues)) {
      if (!result.fileSpecificIssues[filePath]) {
        result.fileSpecificIssues[filePath] = {
          critical: [],
          warnings: [],
          suggestions: []
        };
      }

      result.fileSpecificIssues[filePath].critical.push(...issues.critical);
      result.fileSpecificIssues[filePath].warnings.push(...issues.warnings);
      result.fileSpecificIssues[filePath].suggestions.push(...issues.suggestions);
    }
  }

  return result;
}

/**
 * Generate a comprehensive performance report by combining code analysis and Lighthouse results
 */
export async function generatePerformanceReport(
  codeAnalysis: CodeAnalysisResult,
  lighthouseResults: string
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not found! Please set it using:\n" +
      "perf-lens config set-key YOUR_API_KEY\n" +
      "Or set the OPENAI_API_KEY environment variable."
    );
  }

  const openai = new OpenAI({ apiKey });
  const spinner = ora('Generating comprehensive performance report...').start();

  // Get the actual file paths that were analyzed
  const actualFilePaths = Object.keys(codeAnalysis.fileSpecificIssues);
  const filePathsString = actualFilePaths.map(file => {
    const relativePath = path.relative(process.cwd(), file);
    return `- \`${relativePath}\``;
  }).join('\n');

  // Create a detailed prompt for the LLM
  const prompt = `You are a performance optimization expert for frontend web applications.
I need you to create a comprehensive performance report by analyzing both static code issues and Lighthouse results.

## Code Analysis Results:
Critical Issues:
${codeAnalysis.critical.join('\n')}

Warnings:
${codeAnalysis.warnings.join('\n')}

Suggestions:
${codeAnalysis.suggestions.join('\n')}

## Lighthouse Results:
${lighthouseResults}

## Actual Files Analyzed:
${filePathsString}

Based on both the code analysis and Lighthouse results, create a comprehensive performance optimization report that:

1. Summarizes the most critical performance issues that should be addressed immediately
2. Provides a file-by-file breakdown of issues, ordered by severity
3. For each issue, includes:
   - Issue type (CRITICAL/WARNING/SUGGESTION)
   - Description of the problem
   - Exact location (file and line numbers where available)
   - Explanation of performance impact
   - Recommended solution with code example if applicable
4. Suggests a prioritized action plan for addressing the issues
5. Estimates the potential performance improvements that could be achieved

IMPORTANT: ONLY reference files that are in the "Actual Files Analyzed" list. DO NOT mention or reference any files that are not in this list. If you're unsure about a specific file, refer to it by its general purpose rather than a specific filename.

Format your response as a well-structured report with clear sections and prioritized recommendations.
Be specific, actionable, and thorough in your analysis.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a performance optimization expert for frontend web applications. Only reference actual files that exist in the project." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 4000,
    });

    spinner.succeed('Generated comprehensive performance report');
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    spinner.fail('Error generating performance report');
    console.error(error);
    return 'Error generating performance report. Please try again.';
  }
}