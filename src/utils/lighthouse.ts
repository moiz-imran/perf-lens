import lighthouse from "lighthouse";
import * as chromeLauncher from 'chrome-launcher';
import { Flags } from 'lighthouse';

export async function runLighthouse(): Promise<string> {
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
    const runnerResult = await lighthouse('http://localhost:3000', options);
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