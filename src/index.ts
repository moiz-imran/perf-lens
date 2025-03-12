#!/usr/bin/env node

import { config } from "dotenv";
config();

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { runLighthouse } from "./utils/lighthouse.js";
import { getApiKey, setApiKey } from "./utils/ai.js";
import { analyzeCodebase } from "./utils/codeAnalysis.js";
import { saveReport } from "./utils/output.js";
import { loadConfig } from "./utils/config.js";
import path from "path";
import type { AIProvider } from "./types/config.js";

// Export only what's necessary for external use
export type { PerflensConfig } from './types/index.js';
export { loadConfig } from './utils/config.js';

const program = new Command();
program.name('perf-lens')
       .description('Performance analysis tool combining Lighthouse audits with static code analysis')
       .version('1.1.0');

program
  .command('config')
  .description('Configure PerfLens settings')
  .addCommand(
    new Command('set-key')
      .description('Set your AI provider API key')
      .argument('<key>', 'Your API key')
      .option('--provider <provider>', 'AI provider (openai, anthropic, or gemini)', 'openai')
      .action((key, options) => {
        try {
          setApiKey(key, options.provider as AIProvider);
          console.log(chalk.green(`${options.provider.toUpperCase()} API key saved successfully!`));
        } catch (error) {
          console.error(chalk.red('Error saving API key:'), error instanceof Error ? error.message : error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('get-key')
      .description('Get your currently configured API key')
      .option('--provider <provider>', 'AI provider (openai, anthropic, or gemini)', 'openai')
      .action((options) => {
        try {
          const key = getApiKey(options.provider as AIProvider);
          if (key) {
            // Only show first and last 4 characters for security
            const maskedKey = `${key.slice(0, 4)}...${key.slice(-4)}`;
            console.log(chalk.blue(`Current ${options.provider.toUpperCase()} API key:`, maskedKey));
          } else {
            console.log(chalk.yellow(`No API key configured for ${options.provider.toUpperCase()}`));
            console.log(chalk.gray(`To set an API key, use:\nperf-lens config set-key YOUR_API_KEY --provider ${options.provider}`));
          }
        } catch (error) {
          console.error(chalk.red('Error getting API key:'), error instanceof Error ? error.message : error);
          process.exit(1);
        }
      })
  );

program
  .command("scan")
  .description("Scan your frontend UI for performance issues")
  .option('-c, --config <path>', 'Path to config file')
  .option('-p, --port <number>', 'Development server port')
  .option('-t, --target <directory>', 'Target directory to scan (default: current directory)')
  .option('-f, --max-files <number>', 'Maximum total number of files to analyze')
  .option('-b, --batch-size <number>', 'Number of files to analyze per batch')
  .option('-s, --max-size <number>', 'Maximum file size in KB to analyze')
  .option('-d, --batch-delay <number>', 'Delay between batches in milliseconds')
  .option('-o, --output <path>', 'Output file path for the report')
  .option('--format <type>', 'Output format (md or html)')
  .option('--mobile', 'Enable mobile emulation')
  .option('--cpu-throttle <number>', 'CPU throttle percentage')
  .option('--network-throttle <type>', 'Network throttle type (slow3G, fast3G, 4G, none)')
  .option('--verbose', 'Enable verbose output')
  .option('--timeout <number>', 'Timeout in milliseconds for Lighthouse analysis')
  .option('--retries <number>', 'Number of retries for failed operations')
  .action(async (options) => {
    const startTime = Date.now();

    try {
      console.clear();
      console.log(chalk.blue.bold('🔍 PerfLens Performance Scanner'));
      console.log(chalk.gray('─'.repeat(50)));

      // Load configuration
      const config = await loadConfig(options.config ? path.resolve(process.cwd(), options.config) : undefined);

      // Override config with CLI options
      if (options.maxFiles) config.analysis!.maxFiles = parseInt(options.maxFiles);
      if (options.batchSize) config.analysis!.batchSize = parseInt(options.batchSize);
      if (options.maxSize) config.analysis!.maxFileSize = parseInt(options.maxSize) * 1024;
      if (options.batchDelay) config.analysis!.batchDelay = parseInt(options.batchDelay);
      if (options.format) config.output!.format = options.format as 'md' | 'html';
      if (options.port) config.lighthouse!.port = parseInt(options.port);
      if (options.target) config.analysis!.targetDir = options.target;
      if (options.verbose) config.verbose = options.verbose;
      if (options.output) {
        const outputPath = options.output;
        config.output = {
          ...config.output,
          directory: path.dirname(outputPath),
          filename: path.basename(outputPath, path.extname(outputPath))
        };
      }
      if (options.mobile) config.lighthouse!.mobileEmulation = true;
      if (options.cpuThrottle) config.lighthouse!.throttling!.cpu = parseInt(options.cpuThrottle);
      if (options.networkThrottle) config.lighthouse!.throttling!.network = options.networkThrottle as 'slow3G' | 'fast3G' | '4G' | 'none';
      if (options.timeout) config.lighthouse!.timeout = parseInt(options.timeout);
      if (options.retries) config.lighthouse!.retries = parseInt(options.retries);

      // Print analysis configuration
      if (config.verbose) {
        console.log(chalk.blue.bold('\nAnalysis Configuration:'));
        if (config.analysis?.targetDir) {
          console.log(`Target directory: ${chalk.yellow(config.analysis.targetDir)}`);
        }
        console.log(`Maximum files to analyze: ${chalk.yellow(config.analysis?.maxFiles)}`);
        console.log(`Files per batch: ${chalk.yellow(config.analysis?.batchSize)}`);
        console.log(`Maximum file size: ${chalk.yellow(config.analysis?.maxFileSize ? Math.round(config.analysis.maxFileSize / 1024) + 'KB' : '100KB')}`);
        console.log(`Batch delay: ${chalk.yellow(config.analysis?.batchDelay)}ms`);
        if (config.ignore?.length) {
          console.log(`Ignore patterns: ${chalk.yellow(config.ignore.length)} patterns`);
        }
        if (config.lighthouse?.port) {
          console.log(`Development server port: ${chalk.yellow(config.lighthouse.port)}`);
        }
        if (config.output?.directory) {
          console.log(`Output directory: ${chalk.yellow(config.output.directory)}`);
        }
        console.log(`Output format: ${chalk.yellow(config.output?.format || 'md')}`);

        if (config.ai) {
          console.log(`AI Provider: ${chalk.yellow(config.ai.provider)}`);
          console.log(`AI Model: ${chalk.yellow(config.ai.model)}`);
          if (config.ai.maxTokens) {
            console.log(`Max Tokens: ${chalk.yellow(config.ai.maxTokens)}`);
          }
          if (config.ai.temperature) {
            console.log(`Temperature: ${chalk.yellow(config.ai.temperature)}`);
          }
        }

        console.log(chalk.gray('─'.repeat(50)));
      }

      // Step 1: Run Lighthouse Analysis
      let lhResults;
      try {
        lhResults = await runLighthouse({
          ...config.lighthouse,
          bundleThresholds: config.bundleThresholds,
          performanceThresholds: config.thresholds,
          verbose: config.verbose,
          ai: config.ai
        });

        // Step 2: Code analysis with Lighthouse context
        console.log('\n' + chalk.blue.bold('🧠 Code Analysis'));
        console.log(chalk.gray('─'.repeat(50)));
        if (config.verbose) {
          console.log(chalk.gray('Analyzing your codebase with Lighthouse insights...'));
        }

        try {
          const codeAnalysisResults = await analyzeCodebase({
            ...config.analysis!,
            lighthouseContext: {
              metrics: lhResults.metrics,
              analysis: lhResults.analysis,
            },
            ignore: config.ignore,
            verbose: config.verbose
          });

          if (config.verbose) {
            // Display results in console
            console.log(`\nFound ${chalk.red(codeAnalysisResults.critical.length.toString())} critical, ${chalk.yellow(codeAnalysisResults.warnings.length.toString())} warnings, and ${chalk.blue(codeAnalysisResults.suggestions.length.toString())} suggestions.\n`);

            if (codeAnalysisResults.critical.length > 0) {
              console.log(chalk.red.bold('\n🚨 Critical Code Issues:'));
              codeAnalysisResults.critical.forEach(issue => console.log(issue));
            }

            if (codeAnalysisResults.warnings.length > 0) {
              console.log(chalk.yellow.bold('\n⚠️  Code Warnings:'));
              codeAnalysisResults.warnings.forEach(issue => console.log(issue));
            }

            if (codeAnalysisResults.suggestions.length > 0) {
              console.log(chalk.blue.bold('\n💡 Code Suggestions:'));
              codeAnalysisResults.suggestions.forEach(issue => console.log(issue));
            }
          }

          // Save report
          const reportData = {
            lighthouse: {
              metrics: lhResults.metrics,
              report: lhResults.report,
              analysis: lhResults.analysis,
            },
            codeAnalysis: {
              critical: codeAnalysisResults.critical,
              warnings: codeAnalysisResults.warnings,
              suggestions: codeAnalysisResults.suggestions,
            },
            metadata: {
              timestamp: new Date().toISOString(),
              duration: Date.now() - startTime,
              config: {
                ...config,
                lighthouse: {
                  ...config.lighthouse,
                  throttling: config.lighthouse?.throttling
                }
              }
            }
          };

          const savedPath = saveReport(
            reportData,
            config.output?.format || 'md',
            config.output?.directory
              ? path.join(
                  config.output.directory,
                  `${config.output.filename || 'performance-report'}${config.output.includeTimestamp ? `-${new Date().toISOString().replace(/[:.]/g, '-')}` : ''}.${config.output.format}`
                )
              : undefined
          );
          console.log(chalk.green(`\nReport saved to: ${savedPath}`));

          // Final summary
          console.log('\n' + chalk.blue.bold('✨ Analysis Complete'));
          console.log(chalk.gray('─'.repeat(50)));

          if (config.verbose) {
            console.log(chalk.gray('Review the two reports above for a complete understanding of your application\'s performance:'));
            console.log(chalk.blue('1. 🌟 Lighthouse Performance Report - Runtime metrics and opportunities'));
            console.log(chalk.blue('2. 🧠 Code Analysis - Specific code-level improvements based on Lighthouse insights'));
          }

        } catch (error) {
          console.error(chalk.red('Error during code analysis:'), error);
          process.exit(1);
        }
      } catch (lhError) {
        if (lhError instanceof Error && lhError.message.includes('No development server detected')) {
          console.log(lhError.message);
          process.exit(1);
        }
        console.error(lhError);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Default command
program
  .action(() => {
    program.help();
  });

program.parse(process.argv);