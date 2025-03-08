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
      const results = await analyzeProject();

      // Group issues by severity for display
      const issues = results.split('\n');
      const critical = issues.filter(i => i.includes('🚨'));
      const warnings = issues.filter(i => i.includes('⚠️'));
      const suggestions = issues.filter(i => i.includes('💡'));

      console.log('\n' + chalk.blue.bold('📊 Performance Analysis Results'));
      console.log(chalk.gray('─'.repeat(50)));

      if (issues.length === 1 && issues[0] === '✅ No issues found') {
        console.log(chalk.green('✨ No issues found! Your code looks great.'));
      } else {
        console.log(`Found ${chalk.red(critical.length.toString())} critical, ${chalk.yellow(warnings.length.toString())} warnings, and ${chalk.blue(suggestions.length.toString())} suggestions.\n`);

        if (critical.length > 0) {
          console.log(chalk.red.bold('\n🚨 Critical Issues:'));
          critical.forEach(issue => console.log(issue));
        }

        if (warnings.length > 0) {
          console.log(chalk.yellow.bold('\n⚠️  Warnings:'));
          warnings.forEach(issue => console.log(issue));
        }

        if (suggestions.length > 0) {
          console.log(chalk.blue.bold('\n💡 Suggestions:'));
          suggestions.forEach(issue => console.log(issue));
        }
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

        // AI Analysis
        mainSpinner.start('Generating detailed optimization recommendations...');
        const allIssues = [
          ...issues.filter(line =>
            line.includes('🚨') ||
            line.includes('⚠️') ||
            line.includes('💡')
          ),
          ...lhResults.split('\n').filter(Boolean)
        ];

        const aiFixes = await getAISuggestions(allIssues);
        mainSpinner.succeed('AI analysis complete');

        console.log('\n' + aiFixes);
      } catch (lhError) {
        mainSpinner.fail('Lighthouse audit failed');
        if (lhError instanceof Error && lhError.message.includes('No development server detected')) {
          console.log(lhError.message);
        } else {
          throw lhError;
        }
      }
    } catch (err) {
      console.error(chalk.red('\n❌ Error:'), (err as Error).message);
      process.exit(1);
    }
  });

program.parse();