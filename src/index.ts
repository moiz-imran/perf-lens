#!/usr/bin/env node

import { config } from "dotenv";
config();

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { analyzeProject } from "./utils/scanner.js";
import { runLighthouse } from "./utils/lighthouse.js";
import { getAISuggestions, setApiKey, getApiKey } from "./utils/ai.js";

const program = new Command();
program.name('perf-lens').description('AI-powered frontend performance optimizer').version('1.0.1');

program
  .command('analyze')
  .description('Analyze the current project for performance issues')
  .action(async () => {
    try {
      const result = await analyzeProject();
      console.log(result);
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'An unknown error occurred'));
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage configuration')
  .command('set-key <key>')
  .description('Set your OpenAI API key')
  .action((key) => {
    try {
      setApiKey(key);
      console.log(chalk.green('✓ API key saved successfully'));
    } catch (error) {
      console.error(chalk.red('Failed to save API key:', error instanceof Error ? error.message : error));
      process.exit(1);
    }
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

      // Static Analysis
      const spinner = ora('Running static code analysis...').start();
      const results = await analyzeProject();
      spinner.succeed('Static analysis complete');

      // Lighthouse Analysis
      spinner.start("Running Lighthouse audit...");
      const lhResults = await runLighthouse();
      spinner.succeed("Lighthouse audit complete");

      console.log('\n' + chalk.blue.bold('📊 Performance Analysis Results'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(results);

      console.log('\n' + chalk.blue.bold('🌟 Lighthouse Performance Metrics'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(lhResults);

      // AI Analysis
      spinner.start("Generating detailed optimization recommendations...");
      const allIssues = [
        ...results.split('\n').filter(line =>
          line.includes('🚨') ||
          line.includes('⚠️') ||
          line.includes('💡')
        ),
        ...lhResults.split('\n').filter(Boolean)
      ];

      const aiFixes = await getAISuggestions(allIssues);
      spinner.succeed("AI analysis complete");

      console.log('\n' + aiFixes);

    } catch (err) {
      console.error(chalk.red("\n❌ Error:"), (err as Error).message);
      process.exit(1);
    }
  });

program.parse();