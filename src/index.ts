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

const program = new Command();
program.name('perf-lens')
       .description('Performance analysis tool combining Lighthouse audits with static code analysis')
       .version('1.1.0');

program
  .command('config')
  .command('set-key')
  .description('Set your OpenAI API key')
  .argument('<key>', 'Your OpenAI API key')
  .action((key) => {
    setApiKey(key);
    console.log(chalk.green('API key saved successfully!'));
  });

program
  .command('config')
  .command('get-key')
  .description('Get your currently configured OpenAI API key')
  .action(() => {
    const key = getApiKey();
    if (key) {
      // Only show first and last 4 characters for security
      const maskedKey = `${key.slice(0, 4)}...${key.slice(-4)}`;
      console.log(chalk.blue('Current API key:', maskedKey));
    } else {
      console.log(chalk.yellow('No API key configured'));
    }
  });

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
  .action(async (options) => {
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

      // Print analysis configuration
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
      console.log(chalk.gray('─'.repeat(50)));

      // Step 1: Run Lighthouse Analysis
      const mainSpinner = ora('Running Lighthouse audit...').start();
      let lhResults;
      try {
        mainSpinner.stop();
        lhResults = await runLighthouse({
          ...config.lighthouse,
          bundleThresholds: config.bundleThresholds,
          performanceThresholds: config.thresholds
        });

        // Print metrics to console
        console.log(lhResults.consoleOutput);

        // Step 2: Code analysis with Lighthouse context
        console.log('\n' + chalk.blue.bold('🧠 Code Analysis'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.gray('Analyzing your codebase with Lighthouse insights...'));

        try {
          const codeAnalysisResults = await analyzeCodebase({
            ...config.analysis!,
            lighthouseContext: {
              metrics: lhResults.metrics,
              analysis: lhResults.analysis,
            },
            ignore: config.ignore
          });

          const totalIssues =
            codeAnalysisResults.critical.length +
            codeAnalysisResults.warnings.length +
            codeAnalysisResults.suggestions.length;

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
          console.log(chalk.gray('Review the two reports above for a complete understanding of your application\'s performance:'));
          console.log(chalk.blue('1. 🌟 Lighthouse Performance Report - Runtime metrics and opportunities'));
          console.log(chalk.blue('2. 🧠 Code Analysis - Specific code-level improvements based on Lighthouse insights'));

        } catch (error) {
          console.error(chalk.red('Error during code analysis:'), error);
        }
      } catch (lhError) {
        mainSpinner.fail('Lighthouse audit failed');
        if (lhError instanceof Error && lhError.message.includes('No development server detected')) {
          console.log(lhError.message);
          return;
        }
        console.error(lhError);
        return;
      }
    } catch (error) {
      console.error('Error:', error);
    }
  });

// Default command
program
  .action(() => {
    program.help();
  });

program.parse(process.argv);