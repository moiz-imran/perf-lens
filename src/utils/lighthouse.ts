import lighthouse, { type Result, Flags } from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import axios from 'axios';
import chalk from 'chalk';
import fs from 'fs';
import inquirer from 'inquirer';
import ora from 'ora';
import { createModel } from './ai.js';
import type {
  LighthouseConfig,
  BundleThresholds,
  PerformanceThresholds,
  AIModelConfig,
  GlobalConfig,
} from '../types/config.js';
import { AIModel } from '../ai/models.js';
import { PromptManager } from '../prompts/promptManager.js';
import { PROMPT_KEYS } from '../prompts/promptConfig.js';

// Add type definitions for Lighthouse audit details
interface AuditItem {
  url: string;
  wastedMs?: number;
  wastedBytes?: number;
  transferSize?: number;
  resourceType?: string;
}

interface AuditDetails {
  type: string;
  items?: AuditItem[];
}

interface LighthouseAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  numericValue: string;
  displayValue?: string;
  details?: AuditDetails;
}

const COMMON_DEV_PORTS = [3000, 5173, 8080, 4321, 4000];

/**
 * Searches for a development server port in package.json scripts
 * @returns {Promise<number | null>} The port number if found, null otherwise
 */
async function findPortInPackageJson(): Promise<number | null> {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const scripts = packageJson.scripts || {};

    // Look for port in dev/start scripts
    const devScripts = Object.values(scripts).filter(
      (script): script is string =>
        typeof script === 'string' && (script.includes('dev') || script.includes('start'))
    );

    for (const script of devScripts) {
      const portMatch =
        script.match(/--port\s+(\d+)/) || script.match(/-p\s+(\d+)/) || script.match(/PORT=(\d+)/);
      if (portMatch) {
        return parseInt(portMatch[1], 10);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // Ignore errors if package.json doesn't exist or is invalid
  }
  return null;
}

/**
 * Checks if a port is accessible on localhost
 * @param {number} port - The port number to check
 * @returns {Promise<boolean>} True if the port is accessible, false otherwise
 */
async function checkPort(port: number): Promise<boolean> {
  try {
    await axios.get(`http://localhost:${port}`, { timeout: 1000 });
    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.code !== 'ECONNREFUSED') {
      return true;
    }
    return false;
  }
}

/**
 * Attempts to find a running development server by checking common ports and package.json
 * @returns {Promise<number | null>} The port number if found, null if no server is detected
 */
async function findDevServer(): Promise<number | null> {
  const spinner = ora('Detecting development server...').start();

  // First try to find port in package.json
  const packageJsonPort = await findPortInPackageJson();
  if (packageJsonPort) {
    spinner.text = `Checking port ${packageJsonPort} from package.json...`;
    if (await checkPort(packageJsonPort)) {
      spinner.succeed(`Development server found on port ${packageJsonPort}`);
      return packageJsonPort;
    }
  }

  // Then try common ports
  for (const port of COMMON_DEV_PORTS) {
    spinner.text = `Checking port ${port}...`;
    if (await checkPort(port)) {
      spinner.succeed(`Development server found on port ${port}`);
      return port;
    }
  }

  spinner.stop();
  console.log(chalk.yellow('\nNo development server detected on common ports.'));

  // If no port found, prompt the user
  const { shouldPrompt } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldPrompt',
      message: 'Would you like to specify a custom port?',
      default: true,
    },
  ]);

  if (!shouldPrompt) {
    return null;
  }

  const { port } = await inquirer.prompt([
    {
      type: 'input',
      name: 'port',
      message: 'Enter your development server port:',
      validate: input => {
        const port = parseInt(input, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return 'Please enter a valid port number (1-65535)';
        }
        return true;
      },
    },
  ]);

  const userPort = parseInt(port, 10);
  spinner.start(`Checking port ${userPort}...`);

  if (await checkPort(userPort)) {
    spinner.succeed(`Development server found on port ${userPort}`);
    return userPort;
  }

  spinner.fail(`Could not connect to port ${userPort}`);
  return null;
}

/**
 * Formats Lighthouse performance metrics into a human-readable report
 * @param {Result} report - The Lighthouse result object
 * @param {BundleThresholds} [bundleThresholds] - Optional thresholds for bundle sizes
 * @param {PerformanceThresholds} [performanceThresholds] - Optional thresholds for performance metrics
 * @returns {string} Formatted report string
 */
function formatLighthouseReport(
  report: Result,
  bundleThresholds?: BundleThresholds,
  performanceThresholds?: PerformanceThresholds
): string {
  const metrics = report.audits as unknown as Record<string, LighthouseAudit>;
  const score = (report.categories.performance?.score || 0) * 100;

  let output = `# Performance Score: ${score.toFixed(0)}%\n`;
  if (performanceThresholds?.performance && score < performanceThresholds.performance) {
    output += `⚠️ Performance score is below threshold of ${performanceThresholds.performance}%\n`;
  }
  output += '\n';

  // Core Web Vitals with thresholds
  output += '## Core Web Vitals\n';

  // First Contentful Paint
  const fcp = parseFloat(metrics['first-contentful-paint']?.numericValue) || 0;
  output += `* First Contentful Paint: ${metrics['first-contentful-paint']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.fcp && fcp > performanceThresholds.fcp) {
    output += ` ⚠️ (exceeds threshold of ${performanceThresholds.fcp}ms)`;
  }
  output += '\n';

  // First Input Delay
  const fid = parseFloat(metrics['first-input-delay']?.numericValue) || 0;
  output += `* First Input Delay: ${metrics['first-input-delay']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.fid && fid > performanceThresholds.fid) {
    output += ` ⚠️ (exceeds threshold of ${performanceThresholds.fid}ms)`;
  }
  output += '\n';

  // Largest Contentful Paint
  const lcp = parseFloat(metrics['largest-contentful-paint']?.numericValue) || 0;
  output += `* Largest Contentful Paint: ${metrics['largest-contentful-paint']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.lcp && lcp > performanceThresholds.lcp) {
    output += ` ⚠️ (exceeds threshold of ${performanceThresholds.lcp}ms)`;
  }
  output += '\n';

  // Total Blocking Time
  const tbt = parseFloat(metrics['total-blocking-time']?.numericValue) || 0;
  output += `* Total Blocking Time: ${metrics['total-blocking-time']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.tbt && tbt > performanceThresholds.tbt) {
    output += ` ⚠️ (exceeds threshold of ${performanceThresholds.tbt}ms)`;
  }
  output += '\n';

  // Cumulative Layout Shift
  const cls = parseFloat(metrics['cumulative-layout-shift']?.numericValue) || 0;
  output += `* Cumulative Layout Shift: ${metrics['cumulative-layout-shift']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.cls && cls > performanceThresholds.cls) {
    output += ` ⚠️ (exceeds threshold of ${performanceThresholds.cls})`;
  }
  output += '\n';

  // Speed Index
  const si = parseFloat(metrics['speed-index']?.numericValue) || 0;
  output += `* Speed Index: ${metrics['speed-index']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.speedIndex && si > performanceThresholds.speedIndex) {
    output += ` ⚠️ (exceeds threshold of ${performanceThresholds.speedIndex}ms)`;
  }
  output += '\n';

  // Time to Interactive
  const tti = parseFloat(metrics['interactive']?.numericValue) || 0;
  output += `* Time to Interactive: ${metrics['interactive']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.tti && tti > performanceThresholds.tti) {
    output += ` ⚠️ (exceeds threshold of ${performanceThresholds.tti}ms)`;
  }
  output += '\n\n';

  // Bundle Size Analysis
  const requests = metrics['network-requests']?.details?.items || [];
  if (requests.length > 0) {
    output += '## Bundle Size Analysis\n';

    // Calculate total bundle size
    const totalJsSize = requests
      .filter(item => item.resourceType === 'Script')
      .reduce((acc, item) => acc + (item.transferSize || 0), 0);

    // Calculate chunk sizes
    const jsChunks = requests
      .filter(item => item.resourceType === 'Script')
      .map(item => ({
        url: item.url || '',
        size: item.transferSize || 0,
      }));

    // Calculate asset sizes by type
    const assetSizes = requests.reduce(
      (acc, item) => {
        if (item.resourceType === 'Image' && item.url) {
          acc.images.push({ url: item.url, size: item.transferSize || 0 });
        } else if (item.resourceType === 'Font' && item.url) {
          acc.fonts.push({ url: item.url, size: item.transferSize || 0 });
        }
        return acc;
      },
      { images: [], fonts: [] } as {
        images: Array<{ url: string; size: number }>;
        fonts: Array<{ url: string; size: number }>;
      }
    );

    // Check against thresholds
    if (bundleThresholds) {
      const totalBundleKb = totalJsSize / 1024;
      const maxBundleKb = parseSizeString(bundleThresholds.maxInitialSize || '0kb');
      if (maxBundleKb > 0 && totalBundleKb > maxBundleKb) {
        output += `⚠️ Total bundle size (${totalBundleKb.toFixed(1)}KB) exceeds threshold (${maxBundleKb}KB)\n`;
      }

      // Check chunk sizes
      const maxChunkKb = parseSizeString(bundleThresholds.maxChunkSize || '0kb');
      if (maxChunkKb > 0) {
        const largeChunks = jsChunks.filter(chunk => chunk.size / 1024 > maxChunkKb);
        if (largeChunks.length > 0) {
          output += '\n### Large JavaScript Chunks:\n';
          largeChunks.forEach(chunk => {
            output += `* ${chunk.url}: ${(chunk.size / 1024).toFixed(1)}KB (exceeds ${maxChunkKb}KB limit)\n`;
          });
        }
      }

      // Check total size
      const maxTotalKb = parseSizeString(bundleThresholds.maxTotalSize || '0kb');
      if (maxTotalKb > 0) {
        const totalSizeKb =
          requests.reduce((acc, item) => acc + (item.transferSize || 0), 0) / 1024;
        if (totalSizeKb > maxTotalKb) {
          output += `\n⚠️ Total transfer size (${totalSizeKb.toFixed(1)}KB) exceeds threshold (${maxTotalKb}KB)\n`;
        }
      }

      // Check async chunks
      const maxAsyncChunks = bundleThresholds.maxAsyncChunks || 0;
      if (maxAsyncChunks > 0) {
        const asyncChunks = jsChunks.filter(
          chunk => chunk.url.includes('chunk') || chunk.url.includes('async')
        );
        if (asyncChunks.length > maxAsyncChunks) {
          output += `\n⚠️ Number of async chunks (${asyncChunks.length}) exceeds threshold (${maxAsyncChunks})\n`;
        }
      }
    }

    output += '\n### Resource Size Summary:\n';
    output += `* Total JavaScript: ${(totalJsSize / 1024).toFixed(1)}KB\n`;
    output += `* Total Images: ${(assetSizes.images.reduce((acc, img) => acc + img.size, 0) / 1024).toFixed(1)}KB\n`;
    output += `* Total Fonts: ${(assetSizes.fonts.reduce((acc, font) => acc + font.size, 0) / 1024).toFixed(1)}KB\n\n`;
  }

  // Performance Opportunities
  const renderBlockingResources = metrics['render-blocking-resources']?.details?.items || [];
  if (renderBlockingResources.length > 0) {
    output += '## Performance Opportunities\n';
    output += `### Render Blocking Resources: ${metrics['render-blocking-resources']?.displayValue}\n`;
    renderBlockingResources.forEach((item: AuditItem) => {
      output += `* ${item.url}: ${item.wastedMs}ms\n`;
    });
    output += '\n';
  }

  // JavaScript Analysis
  const unusedJs = metrics['unused-javascript']?.details?.items || [];
  const unminifiedJs = metrics['unminified-javascript']?.details?.items || [];
  if (unusedJs.length > 0 || unminifiedJs.length > 0) {
    output += '## JavaScript Issues\n';
    if (unusedJs.length > 0) {
      output += '### Unused JavaScript\n';
      unusedJs.forEach((item: AuditItem) => {
        output += `* ${item.url}: ${item.wastedBytes} bytes unused\n`;
      });
      output += '\n';
    }
    if (unminifiedJs.length > 0) {
      output += '### Unminified JavaScript\n';
      unminifiedJs.forEach((item: AuditItem) => {
        output += `* ${item.url}: Could save ${item.wastedBytes} bytes\n`;
      });
      output += '\n';
    }
  }

  // CSS Analysis
  const unusedCss = metrics['unused-css-rules']?.details?.items || [];
  const unminifiedCss = metrics['unminified-css']?.details?.items || [];
  if (unusedCss.length > 0 || unminifiedCss.length > 0) {
    output += '## CSS Issues\n';
    if (unusedCss.length > 0) {
      output += '### Unused CSS Rules\n';
      unusedCss.forEach((item: AuditItem) => {
        output += `* ${item.url}: ${item.wastedBytes} bytes unused\n`;
      });
      output += '\n';
    }
    if (unminifiedCss.length > 0) {
      output += '### Unminified CSS\n';
      unminifiedCss.forEach((item: AuditItem) => {
        output += `* ${item.url}: Could save ${item.wastedBytes} bytes\n`;
      });
      output += '\n';
    }
  }

  // Network Analysis
  const networkRequests = metrics['network-requests']?.details?.items || [];
  if (networkRequests.length > 0) {
    output += '## Network Analysis\n';
    const totalBytes = networkRequests.reduce(
      (acc: number, item: AuditItem) => acc + (item.transferSize || 0),
      0
    );
    output += `Total Transfer Size: ${(totalBytes / 1024).toFixed(2)}KB\n\n`;

    // Group by resource type
    const byType = networkRequests.reduce((acc: Record<string, number>, item: AuditItem) => {
      if (item.resourceType) {
        acc[item.resourceType] = (acc[item.resourceType] || 0) + (item.transferSize || 0);
      }
      return acc;
    }, {});

    output += '### Resource Breakdown\n';
    Object.entries(byType).forEach(([type, size]) => {
      output += `* ${type}: ${(size / 1024).toFixed(2)}KB\n`;
    });
    output += '\n';
  }

  return output;
}

/**
 * Formats Lighthouse results for console output
 * @param {Result} report - The Lighthouse result object
 * @param {PerformanceThresholds} [performanceThresholds] - Optional thresholds for performance metrics
 * @returns {string} Formatted console output string
 */
function formatConsoleOutput(
  report: Result,
  performanceThresholds?: PerformanceThresholds
): string {
  const metrics = report.audits as unknown as Record<string, LighthouseAudit>;
  const score = (report.categories.performance?.score || 0) * 100;

  let output = `Performance Score: ${score.toFixed(0)}%`;
  if (performanceThresholds?.performance && score < performanceThresholds.performance) {
    output += chalk.yellow(` ⚠️  Below threshold of ${performanceThresholds.performance}%`);
  }
  output += '\n\n';

  // Core Web Vitals
  output += chalk.blue.bold('Core Web Vitals:\n');

  // First Contentful Paint
  const fcp = parseFloat(metrics['first-contentful-paint']?.numericValue) || 0;
  output += `First Contentful Paint: ${metrics['first-contentful-paint']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.fcp && fcp > performanceThresholds.fcp) {
    output += chalk.yellow(` ⚠️  Exceeds ${performanceThresholds.fcp}ms`);
  }
  output += '\n';

  // First Input Delay
  const fid = parseFloat(metrics['first-input-delay']?.numericValue) || 0;
  output += `First Input Delay: ${metrics['first-input-delay']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.fid && fid > performanceThresholds.fid) {
    output += chalk.yellow(` ⚠️  Exceeds ${performanceThresholds.fid}ms`);
  }
  output += '\n';

  // Largest Contentful Paint
  const lcp = parseFloat(metrics['largest-contentful-paint']?.numericValue) || 0;
  output += `Largest Contentful Paint: ${metrics['largest-contentful-paint']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.lcp && lcp > performanceThresholds.lcp) {
    output += chalk.yellow(` ⚠️  Exceeds ${performanceThresholds.lcp}ms`);
  }
  output += '\n';

  // Total Blocking Time
  const tbt = parseFloat(metrics['total-blocking-time']?.numericValue) || 0;
  output += `Total Blocking Time: ${metrics['total-blocking-time']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.tbt && tbt > performanceThresholds.tbt) {
    output += chalk.yellow(` ⚠️  Exceeds ${performanceThresholds.tbt}ms`);
  }
  output += '\n';

  // Cumulative Layout Shift
  const cls = parseFloat(metrics['cumulative-layout-shift']?.numericValue) || 0;
  output += `Cumulative Layout Shift: ${metrics['cumulative-layout-shift']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.cls && cls > performanceThresholds.cls) {
    output += chalk.yellow(` ⚠️  Exceeds ${performanceThresholds.cls}`);
  }
  output += '\n';

  // Speed Index
  const si = parseFloat(metrics['speed-index']?.numericValue) || 0;
  output += `Speed Index: ${metrics['speed-index']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.speedIndex && si > performanceThresholds.speedIndex) {
    output += chalk.yellow(` ⚠️  Exceeds ${performanceThresholds.speedIndex}ms`);
  }
  output += '\n';

  // Time to Interactive
  const tti = parseFloat(metrics['interactive']?.numericValue) || 0;
  output += `Time to Interactive: ${metrics['interactive']?.displayValue || 'N/A'}`;
  if (performanceThresholds?.tti && tti > performanceThresholds.tti) {
    output += chalk.yellow(` ⚠️  Exceeds ${performanceThresholds.tti}ms`);
  }
  output += '\n\n';

  // Performance Opportunities
  const renderBlockingResources = metrics['render-blocking-resources']?.details?.items || [];
  if (renderBlockingResources.length > 0) {
    output += chalk.yellow.bold('Performance Opportunities:\n');
    output += `• Render Blocking Resources: ${metrics['render-blocking-resources']?.displayValue}\n`;
    renderBlockingResources.forEach((item: AuditItem) => {
      output += `  - ${item.url}: ${item.wastedMs}ms\n`;
    });
    output += '\n';
  }

  // JavaScript Analysis
  const unusedJs = metrics['unused-javascript']?.details?.items || [];
  const unminifiedJs = metrics['unminified-javascript']?.details?.items || [];
  if (unusedJs.length > 0 || unminifiedJs.length > 0) {
    output += chalk.yellow.bold('JavaScript Issues:\n');
    if (unusedJs.length > 0) {
      output += '• Unused JavaScript:\n';
      unusedJs.forEach((item: AuditItem) => {
        output += `  - ${item.url}: ${item.wastedBytes} bytes unused\n`;
      });
    }
    if (unminifiedJs.length > 0) {
      output += '• Unminified JavaScript:\n';
      unminifiedJs.forEach((item: AuditItem) => {
        output += `  - ${item.url}: Could save ${item.wastedBytes} bytes\n`;
      });
    }
    output += '\n';
  }

  // CSS Analysis
  const unusedCss = metrics['unused-css-rules']?.details?.items || [];
  const unminifiedCss = metrics['unminified-css']?.details?.items || [];
  if (unusedCss.length > 0 || unminifiedCss.length > 0) {
    output += chalk.yellow.bold('CSS Issues:\n');
    if (unusedCss.length > 0) {
      output += '• Unused CSS Rules:\n';
      unusedCss.forEach((item: AuditItem) => {
        output += `  - ${item.url}: ${item.wastedBytes} bytes unused\n`;
      });
    }
    if (unminifiedCss.length > 0) {
      output += '• Unminified CSS:\n';
      unminifiedCss.forEach((item: AuditItem) => {
        output += `  - ${item.url}: Could save ${item.wastedBytes} bytes\n`;
      });
    }
    output += '\n';
  }

  // Network Analysis
  const networkRequests = metrics['network-requests']?.details?.items || [];
  if (networkRequests.length > 0) {
    output += chalk.yellow.bold('Network Analysis:\n');
    const totalBytes = networkRequests.reduce(
      (acc: number, item: AuditItem) => acc + (item.transferSize || 0),
      0
    );
    output += `Total Transfer Size: ${(totalBytes / 1024).toFixed(2)}KB\n`;

    // Group by resource type
    const byType = networkRequests.reduce((acc: Record<string, number>, item: AuditItem) => {
      if (item.resourceType) {
        acc[item.resourceType] = (acc[item.resourceType] || 0) + (item.transferSize || 0);
      }
      return acc;
    }, {});

    output += 'Resource Breakdown:\n';
    Object.entries(byType).forEach(([type, size]) => {
      output += `  - ${type}: ${(size / 1024).toFixed(2)}KB\n`;
    });
    output += '\n';
  }

  return output;
}

/**
 * Analyzes Lighthouse report using AI to provide insights and recommendations
 * @param {Result} report - The Lighthouse result object
 * @param {AIModel} model - The AI model instance for analysis
 * @param {PerformanceThresholds} [performanceThresholds] - Optional thresholds for performance metrics
 * @param {boolean} [verbose] - Whether to enable verbose output
 * @returns {Promise<{ coreWebVitals: string, performanceOpportunities: string, diagnostics: string }>} AI-generated analysis of the report
 */
async function analyzeLighthouseReport(
  report: Result,
  model: AIModel,
  performanceThresholds?: PerformanceThresholds,
  verbose?: boolean
): Promise<{
  coreWebVitals: string;
  performanceOpportunities: string;
  diagnostics: string;
}> {
  const spinner = ora('Analyzing Lighthouse results...').start();
  const promptManager = PromptManager.getInstance();

  // Split analysis into focused sections
  const sections = [
    {
      name: 'Core Web Vitals',
      data: {
        metrics: {
          'first-contentful-paint': report.audits['first-contentful-paint'],
          'largest-contentful-paint': report.audits['largest-contentful-paint'],
          'total-blocking-time': report.audits['total-blocking-time'],
          'cumulative-layout-shift': report.audits['cumulative-layout-shift'],
          'speed-index': report.audits['speed-index'],
          interactive: report.audits['interactive'],
        },
        thresholds: {
          fcp: performanceThresholds?.fcp || 1800,
          lcp: performanceThresholds?.lcp || 2500,
          tbt: performanceThresholds?.tbt || 200,
          cls: performanceThresholds?.cls || 0.1,
          speedIndex: performanceThresholds?.speedIndex || 3400,
          tti: performanceThresholds?.tti || 3800,
          fid: performanceThresholds?.fid || 100,
          performance: performanceThresholds?.performance || 90,
        },
      },
    },
    {
      name: 'Performance Opportunities',
      data: {
        metrics: {
          'render-blocking-resources': report.audits['render-blocking-resources'],
          'unused-javascript': report.audits['unused-javascript'],
          'unused-css-rules': report.audits['unused-css-rules'],
          'offscreen-images': report.audits['offscreen-images'],
          'unminified-javascript': report.audits['unminified-javascript'],
          'unminified-css': report.audits['unminified-css'],
          'modern-image-formats': report.audits['modern-image-formats'],
        },
      },
    },
    {
      name: 'Diagnostics',
      data: {
        metrics: {
          'mainthread-work-breakdown': report.audits['mainthread-work-breakdown'],
          'dom-size': report.audits['dom-size'],
          'critical-request-chains': report.audits['critical-request-chains'],
          'network-requests': report.audits['network-requests'],
          'network-rtt': report.audits['network-rtt'],
          'network-server-latency': report.audits['network-server-latency'],
        },
      },
    },
  ];

  const analysisResults: Record<string, string> = {
    coreWebVitals: '',
    performanceOpportunities: '',
    diagnostics: '',
  };

  for (const section of sections) {
    spinner.text = `Analyzing ${section.name}...`;

    const basePrompt = promptManager.getPrompt(PROMPT_KEYS.LIGHTHOUSE_ANALYSIS);
    const prompt = `${basePrompt}

Please analyze this section of the Lighthouse performance report and provide detailed insights and recommendations.

Section: ${section.name}
Performance Score: ${(report.categories.performance?.score || 0) * 100}%

${
  section.data.thresholds
    ? `Performance Thresholds:
      ${JSON.stringify(section.data.thresholds, null, 2)}`
    : ''
}

Metrics Data:
${JSON.stringify(section.data.metrics, null, 2)}`;

    try {
      const systemPrompt = promptManager.getPrompt(PROMPT_KEYS.PERFORMANCE_EXPERT);
      const response = await model.generateSuggestions(prompt, {
        systemPrompt,
        onChunk: (chunk, firstChunk) => {
          if (verbose) {
            if (firstChunk) {
              spinner.stop();
              console.log(`\n# ${section.name}\n\n`);
            }
            process.stdout.write(chunk);
          }
        },
      });

      if (!response || response.trim() === '') {
        console.error(`Warning: Empty response received for ${section.name}`);
        analysisResults[section.name.toLowerCase().replace(/\s+/g, '')] =
          `No analysis available for ${section.name}. Please check the raw Lighthouse report for details.`;
        continue;
      }

      // Store the analysis in the corresponding section
      switch (section.name) {
        case 'Core Web Vitals':
          analysisResults.coreWebVitals = response;
          break;
        case 'Performance Opportunities':
          analysisResults.performanceOpportunities = response;
          break;
        case 'Diagnostics':
          analysisResults.diagnostics = response;
          break;
      }
    } catch (error) {
      console.error(`Error analyzing ${section.name}:`, error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      }
      analysisResults[section.name.toLowerCase().replace(/\s+/g, '')] =
        `Error analyzing ${section.name}. Please check the raw Lighthouse report for details.`;
    }

    // Add a small delay between API calls to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  spinner.succeed('Lighthouse analysis complete');

  return {
    coreWebVitals: analysisResults.coreWebVitals,
    performanceOpportunities: analysisResults.performanceOpportunities,
    diagnostics: analysisResults.diagnostics,
  };
}

/**
 * Parses a size string (e.g., '200kb', '1mb') into kilobytes
 * @param size - The size string to parse
 * @returns The size in kilobytes
 */
function parseSizeString(size: string): number {
  const match = size.match(/^(\d+(?:\.\d+)?)(kb|mb|gb)$/i);
  if (!match) return 0;

  const [, value, unit] = match;
  const numValue = parseFloat(value);

  switch (unit.toLowerCase()) {
    case 'kb':
      return numValue;
    case 'mb':
      return numValue * 1024;
    case 'gb':
      return numValue * 1024 * 1024;
    default:
      return 0;
  }
}

/**
 * Runs Lighthouse performance analysis on the development server
 * @param {LighthouseConfig & { bundleThresholds?: BundleThresholds, performanceThresholds?: PerformanceThresholds, ai?: AIModelConfig } & GlobalConfig} config - Configuration options for Lighthouse analysis
 * @returns {Promise<{ metrics: string, report: string, analysis: { coreWebVitals: string, performanceOpportunities: string, diagnostics: string }, fullReport: Result }>} Object containing formatted metrics, report, AI analysis, and full Lighthouse result
 */
export async function runLighthouse(
  config?: LighthouseConfig & {
    bundleThresholds?: BundleThresholds;
    performanceThresholds?: PerformanceThresholds;
    ai?: AIModelConfig;
  } & GlobalConfig
): Promise<{
  metrics: string;
  report: string;
  analysis: {
    coreWebVitals: string;
    performanceOpportunities: string;
    diagnostics: string;
  };
  fullReport: Result;
}> {
  // Check for running dev server
  const port = config?.port || (await findDevServer());
  if (!port) {
    throw new Error(
      chalk.red('\nNo development server detected!') +
        '\nPlease ensure your development server is running.' +
        '\nTypical commands to start a dev server:' +
        '\n- npm run dev' +
        '\n- yarn dev' +
        '\n- pnpm dev'
    );
  }

  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  let retryCount = 0;
  const maxRetries = config?.retries || 3;
  const timeout = config?.timeout || 30000; // 30 seconds default timeout

  const options: Flags = {
    logLevel: 'error' as const,
    output: 'json' as const,
    onlyCategories: ['performance'],
    port: chrome.port,
    formFactor: config?.mobileEmulation ? 'mobile' : ('desktop' as const),
    screenEmulation: config?.mobileEmulation
      ? {
          mobile: true,
          width: 375,
          height: 667,
          deviceScaleFactor: 2,
          disabled: false,
        }
      : {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        },
    throttling: {
      cpuSlowdownMultiplier: config?.throttling?.cpu || 4,
      // Network throttling presets
      ...(config?.throttling?.network === 'slow3G'
        ? {
            rttMs: 150,
            throughputKbps: 1638.4,
            requestLatencyMs: 562.5,
            downloadThroughputKbps: 1474.5600000000002,
            uploadThroughputKbps: 675,
          }
        : config?.throttling?.network === 'fast3G'
          ? {
              rttMs: 40,
              throughputKbps: 10240,
              requestLatencyMs: 150,
              downloadThroughputKbps: 9216,
              uploadThroughputKbps: 3075,
            }
          : config?.throttling?.network === '4G'
            ? {
                rttMs: 20,
                throughputKbps: 20480,
                requestLatencyMs: 75,
                downloadThroughputKbps: 18432,
                uploadThroughputKbps: 6144,
              }
            : {
                rttMs: 0,
                throughputKbps: 0,
                requestLatencyMs: 0,
                downloadThroughputKbps: 0,
                uploadThroughputKbps: 0,
              }),
    },
  };

  const model = createModel(config?.ai || { provider: 'openai', model: 'o3-mini' });

  while (retryCount < maxRetries) {
    try {
      if (config?.verbose) {
        console.log(
          chalk.blue(
            `\nRunning Lighthouse on http://localhost:${port} (Attempt ${retryCount + 1}/${maxRetries})`
          )
        );
      }

      const spinner = ora('Running Lighthouse audit...').start();

      const runnerResult = (await Promise.race([
        lighthouse(`http://localhost:${port}`, options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Lighthouse analysis timed out')), timeout)
        ),
      ])) as { lhr: Result };

      if (!runnerResult?.lhr) {
        spinner.fail('Lighthouse audit failed');
        throw new Error('Failed to get Lighthouse results');
      }

      const report = runnerResult.lhr;
      spinner.succeed('Lighthouse audit complete');
      chrome.kill();

      const formattedReport = formatLighthouseReport(
        report,
        config?.bundleThresholds,
        config?.performanceThresholds
      );

      if (config?.verbose) {
        // Print metrics to console
        console.log(formatConsoleOutput(report, config?.performanceThresholds));
      }

      const analysis = await analyzeLighthouseReport(
        report,
        model,
        config?.performanceThresholds,
        config?.verbose
      );

      const score = (report.categories.performance?.score || 0) * 100;
      const metrics = report.audits;

      const metricsString =
        `Performance Score: ${score.toFixed(0)}%\n` +
        `First Contentful Paint: ${metrics['first-contentful-paint']?.displayValue || 'N/A'}\n` +
        `Time to Interactive: ${metrics['interactive']?.displayValue || 'N/A'}\n` +
        `Speed Index: ${metrics['speed-index']?.displayValue || 'N/A'}`;

      return {
        metrics: metricsString,
        report: formattedReport,
        analysis,
        fullReport: report,
      };
    } catch (error) {
      retryCount++;
      if (retryCount === maxRetries) {
        await chrome.kill();
        throw error;
      }
      if (config?.verbose) {
        console.log(chalk.yellow(`\nAttempt ${retryCount} failed. Retrying...`));
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
    }
  }

  await chrome.kill();
  throw new Error('Failed to run Lighthouse after maximum retries');
}
