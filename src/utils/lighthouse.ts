import lighthouse from "lighthouse";
import * as chromeLauncher from 'chrome-launcher';
import { Flags } from 'lighthouse';
import axios from 'axios';
import chalk from 'chalk';
import fs from 'fs';
import inquirer from 'inquirer';
import ora from 'ora';

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

export async function runLighthouse(): Promise<string> {
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

    return `Performance Score: ${score.toFixed(0)}%\n` +
           `First Contentful Paint: ${metrics['first-contentful-paint']?.displayValue || 'N/A'}\n` +
           `Time to Interactive: ${metrics['interactive']?.displayValue || 'N/A'}\n` +
           `Speed Index: ${metrics['speed-index']?.displayValue || 'N/A'}`;
  } catch (error) {
    await chrome.kill();
    throw error;
  }
}