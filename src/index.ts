#!/usr/bin/env node

import { config } from "dotenv";
config();

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { runLighthouse } from "./utils/lighthouse.js";
import { getApiKey, setApiKey } from "./utils/ai.js";
import { analyzeCodebase, generatePerformanceReport } from "./utils/codeAnalysis.js";

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
  .action(async () => {
    try {
      console.clear();
      console.log(chalk.blue.bold('🔍 PerfLens Performance Scanner'));
      console.log(chalk.gray('─'.repeat(50)));

      // AI-powered code analysis
      console.log(chalk.blue.bold('🧠 AI-Powered Code Analysis'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.gray('Analyzing your codebase for performance optimizations...'));

      let codeAnalysisResults;
      try {
        codeAnalysisResults = await analyzeCodebase();

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
      } catch (error) {
        console.error(chalk.red('Error during AI code analysis:'), error);
        console.log(chalk.yellow('Continuing with Lighthouse analysis...'));
      }

      // Lighthouse Analysis
      const mainSpinner = ora('Running Lighthouse audit...').start();
      try {
        // Stop the main spinner before running Lighthouse (which has its own prompts)
        mainSpinner.stop();

        const lhResults = await runLighthouse();
        console.log('\n' + chalk.blue.bold('🌟 Lighthouse Performance Metrics'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(lhResults);

        // Generate comprehensive report
        if (codeAnalysisResults) {
          console.log('\n' + chalk.blue.bold('📑 Generating Comprehensive Performance Report'));
          console.log(chalk.gray('─'.repeat(50)));

          mainSpinner.start('Generating detailed optimization recommendations...');
          const comprehensiveReport = await generatePerformanceReport(codeAnalysisResults, lhResults);
          mainSpinner.succeed('AI analysis complete');

          console.log('\n' + comprehensiveReport);
        }
      } catch (lhError) {
        mainSpinner.fail('Lighthouse audit failed');
        if (lhError instanceof Error && lhError.message.includes('No development server detected')) {
          console.log(lhError.message);
        } else {
          console.error(lhError);
        }
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