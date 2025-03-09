import lighthouse, { type Result } from "lighthouse";
import * as chromeLauncher from 'chrome-launcher';
import { Flags } from 'lighthouse';
import axios from 'axios';
import chalk from 'chalk';
import fs from 'fs';
import inquirer from 'inquirer';
import ora from 'ora';
import { OpenAI } from 'openai';
import { getApiKey } from './ai.js';

const COMMON_DEV_PORTS = [3000, 3001, 5173, 8080, 4321, 4000];

async function findPortInPackageJson(): Promise<number | null> {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const scripts = packageJson.scripts || {};

    // Look for port in dev/start scripts
    const devScripts = Object.values(scripts).filter((script): script is string =>
      typeof script === 'string' &&
      (script.includes('dev') || script.includes('start'))
    );

    for (const script of devScripts) {
      const portMatch = script.match(/--port\s+(\d+)/) ||
                       script.match(/-p\s+(\d+)/) ||
                       script.match(/PORT=(\d+)/);
      if (portMatch) {
        return parseInt(portMatch[1], 10);
      }
    }
  } catch (error) {
    // Ignore errors if package.json doesn't exist or is invalid
  }
  return null;
}

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
      default: true
    }
  ]);

  if (!shouldPrompt) {
    return null;
  }

  const { port } = await inquirer.prompt([
    {
      type: 'input',
      name: 'port',
      message: 'Enter your development server port:',
      validate: (input) => {
        const port = parseInt(input, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return 'Please enter a valid port number (1-65535)';
        }
        return true;
      }
    }
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

async function analyzeLighthouseReport(report: any): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not found! Please set it using:\n" +
      "perf-lens config set-key YOUR_API_KEY\n" +
      "Or set the OPENAI_API_KEY environment variable."
    );
  }

  const openai = new OpenAI({ apiKey });
  const spinner = ora('Analyzing Lighthouse results...').start();

  // Split analysis into focused sections
  const sections = [
    {
      name: 'Core Web Vitals',
      data: {
        'first-contentful-paint': report.audits['first-contentful-paint'],
        'largest-contentful-paint': report.audits['largest-contentful-paint'],
        'total-blocking-time': report.audits['total-blocking-time'],
        'cumulative-layout-shift': report.audits['cumulative-layout-shift'],
        'speed-index': report.audits['speed-index'],
        'interactive': report.audits['interactive']
      }
    },
    {
      name: 'Performance Opportunities',
      data: {
        'render-blocking-resources': report.audits['render-blocking-resources'],
        'unused-javascript': report.audits['unused-javascript'],
        'unused-css-rules': report.audits['unused-css-rules'],
        'offscreen-images': report.audits['offscreen-images'],
        'unminified-javascript': report.audits['unminified-javascript'],
        'unminified-css': report.audits['unminified-css'],
        'modern-image-formats': report.audits['modern-image-formats']
      }
    },
    {
      name: 'Diagnostics',
      data: {
        'mainthread-work-breakdown': report.audits['mainthread-work-breakdown'],
        'dom-size': report.audits['dom-size'],
        'critical-request-chains': report.audits['critical-request-chains'],
        'network-requests': report.audits['network-requests'],
        'network-rtt': report.audits['network-rtt'],
        'network-server-latency': report.audits['network-server-latency']
      }
    }
  ];

  let analysisResults = [];

  for (const section of sections) {
    spinner.text = `Analyzing ${section.name}...`;

    const prompt = `You are a performance optimization expert for frontend web applications.
Please analyze this section of the Lighthouse performance report and provide detailed insights and recommendations.

Section: ${section.name}
Performance Score: ${(report.categories.performance?.score || 0) * 100}%

Data:
${JSON.stringify(section.data, null, 2)}

Please provide a focused analysis that includes:

1. Key Findings
   - Analysis of each metric/audit in this section
   - Most significant issues identified
   - Impact on overall performance

2. Detailed Recommendations
   - Specific technical solutions for each issue
   - Prioritized list of improvements
   - Expected impact of each solution
   - Code or configuration examples where applicable

Format your response in a clear, structured manner.
Focus on actionable insights and quantifiable improvements.
Be specific about the impact of each issue and the potential benefits of fixing it.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a performance optimization expert specializing in Lighthouse performance analysis." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 2000,
      });

      analysisResults.push({
        section: section.name,
        analysis: response.choices[0]?.message?.content || ''
      });
    } catch (error) {
      console.error(`Error analyzing ${section.name}:`, error);
      analysisResults.push({
        section: section.name,
        analysis: `Error analyzing ${section.name}. Please check the raw Lighthouse report for details.`
      });
    }

    // Add a small delay between API calls to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate executive summary
  spinner.text = 'Generating executive summary...';

  const summaryPrompt = `You are a performance optimization expert for frontend web applications.
Please create an executive summary of the Lighthouse performance analysis.

Overall Performance Score: ${(report.categories.performance?.score || 0) * 100}%

Previous Section Analyses:
${analysisResults.map(r => `## ${r.section}\n${r.analysis}`).join('\n\n')}

Please provide:
1. A brief executive summary of the most critical performance issues
2. Top 3-5 highest impact recommendations
3. Estimated potential performance improvements

Keep this summary concise and focused on the most important findings.`;

  try {
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a performance optimization expert specializing in Lighthouse performance analysis." },
        { role: "user", content: summaryPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const executiveSummary = summaryResponse.choices[0]?.message?.content || '';

    spinner.succeed('Lighthouse analysis complete');

    // Combine all analyses into a well-formatted report
    return `# Lighthouse Performance Analysis

## Executive Summary
${executiveSummary}

${analysisResults.map(r => `## ${r.section}\n${r.analysis}`).join('\n\n')}`;

  } catch (error) {
    spinner.fail('Error generating executive summary');
    console.error(error);

    // Return the section analyses without an executive summary
    return `# Lighthouse Performance Analysis

${analysisResults.map(r => `## ${r.section}\n${r.analysis}`).join('\n\n')}`;
  }
}

export async function runLighthouse(): Promise<{ metrics: string, fullReport: Result, analysis: string }> {
  // Check for running dev server
  const port = await findDevServer();
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

  const chrome = await chromeLauncher.launch({chromeFlags: ['--headless']});

  const options: Flags = {
    logLevel: 'error' as const,
    output: 'json' as const,
    onlyCategories: ['performance'],
    port: chrome.port,
    formFactor: 'mobile' as const,
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      disabled: false,
    }
  };

  try {
    console.log(chalk.blue(`\nRunning Lighthouse on http://localhost:${port}`));
    const runnerResult = await lighthouse(`http://localhost:${port}`, options);
    if (!runnerResult?.lhr) {
      throw new Error('Failed to get Lighthouse results');
    }

    const report = runnerResult.lhr;
    await chrome.kill();

    const score = (report.categories.performance?.score || 0) * 100;
    const metrics = report.audits;

    const metricsString = `Performance Score: ${score.toFixed(0)}%\n` +
           `First Contentful Paint: ${metrics['first-contentful-paint']?.displayValue || 'N/A'}\n` +
           `Time to Interactive: ${metrics['interactive']?.displayValue || 'N/A'}\n` +
           `Speed Index: ${metrics['speed-index']?.displayValue || 'N/A'}`;

    // Get AI analysis of the full report
    const analysis = await analyzeLighthouseReport(report);

    return {
      metrics: metricsString,
      fullReport: report,
      analysis
    };
  } catch (error) {
    await chrome.kill();
    throw error;
  }
}