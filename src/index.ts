#!/usr/bin/env node

import { config } from "dotenv";
config();

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { runLighthouse } from "./utils/lighthouse.js";
import { getApiKey, setApiKey } from "./utils/ai.js";
import { analyzeCodebase } from "./utils/codeAnalysis.js";

const program = new Command();
program.name('perf-lens').description('AI-powered frontend performance optimizer').version('1.1.0');

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
  .option('--max-files <number>', 'Maximum total number of files to analyze', '200')
  .option('--batch-size <number>', 'Number of files to analyze per batch', '20')
  .option('--max-size <number>', 'Maximum file size in KB to analyze', '100')
  .option('--batch-delay <number>', 'Delay between batches in milliseconds', '1000')
  .option('--max-tokens <number>', 'Maximum tokens per batch (affects how much code can be analyzed at once)', '100000')
  .action(async (options) => {
    try {
      console.clear();
      console.log(chalk.blue.bold('🔍 PerfLens Performance Scanner'));
      console.log(chalk.gray('─'.repeat(50)));

      // Parse configuration options
      const config = {
        maxTotalFiles: parseInt(options.maxFiles),
        maxFilesPerBatch: parseInt(options.batchSize),
        maxFileSize: parseInt(options.maxSize) * 1024, // Convert KB to bytes
        batchDelayMs: parseInt(options.batchDelay),
        maxTokensPerBatch: parseInt(options.maxTokens)
      };

      // Print analysis configuration
      console.log(chalk.blue.bold('\nAnalysis Configuration:'));
      console.log(`Maximum files to analyze: ${chalk.yellow(config.maxTotalFiles)}`);
      console.log(`Files per batch: ${chalk.yellow(config.maxFilesPerBatch)}`);
      console.log(`Maximum file size: ${chalk.yellow(options.maxSize)}KB`);
      console.log(`Batch delay: ${chalk.yellow(config.batchDelayMs)}ms`);
      console.log(`Maximum tokens per batch: ${chalk.yellow(config.maxTokensPerBatch)}`);
      console.log(chalk.gray('─'.repeat(50)));

      // Step 1: Run Lighthouse Analysis
      const mainSpinner = ora('Running Lighthouse audit...').start();
      let lhResults;
      try {
        mainSpinner.stop();
        lhResults = await runLighthouse();

        console.log('\n' + chalk.blue.bold('🌟 Lighthouse Performance Report'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(lhResults.metrics);
      } catch (lhError) {
        mainSpinner.fail('Lighthouse audit failed');
        if (lhError instanceof Error && lhError.message.includes('No development server detected')) {
          console.log(lhError.message);
          return;
        }
        console.error(lhError);
        return;
      }

      // Step 2: Code analysis with Lighthouse context
      console.log('\n' + chalk.blue.bold('🧠 AI-Powered Code Analysis'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.gray('Analyzing your codebase with Lighthouse insights...'));

      try {
        const codeAnalysisResults = await analyzeCodebase({
          ...config,
          lighthouseContext: {
            metrics: lhResults.metrics,
            analysis: lhResults.analysis,
          }
        });

        const totalIssues =
          codeAnalysisResults.critical.length +
          codeAnalysisResults.warnings.length +
          codeAnalysisResults.suggestions.length;

        console.log(`\nAI found ${chalk.red(codeAnalysisResults.critical.length.toString())} critical, ${chalk.yellow(codeAnalysisResults.warnings.length.toString())} warnings, and ${chalk.blue(codeAnalysisResults.suggestions.length.toString())} suggestions.\n`);

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

        // Final summary
        console.log('\n' + chalk.blue.bold('✨ Analysis Complete'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.gray('Review the two reports above for a complete understanding of your application\'s performance:'));
        console.log(chalk.blue('1. 🌟 Lighthouse Performance Report - Runtime metrics and opportunities'));
        console.log(chalk.blue('2. 🧠 Code Analysis - Specific code-level improvements based on Lighthouse insights'));

      } catch (error) {
        console.error(chalk.red('Error during AI code analysis:'), error);
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