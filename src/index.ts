#!/usr/bin/env node

import { config } from "dotenv";
config();

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { analyzeProject } from "./utils/scanner.js";
import { runLighthouse } from "./utils/lighthouse.js";
import { getAISuggestions } from "./utils/ai.js";

const program = new Command();
program.version("1.0.0").description("AI-Powered Frontend Performance Optimizer");

program
  .command("scan")
  .description("Scan your frontend UI for performance issues")
  .action(async () => {
    try {
      // Static Analysis
      const results = await analyzeProject();

      // Lighthouse Analysis
      const spinner = ora("Running Lighthouse audit...").start();
      const lhResults = await runLighthouse();
      spinner.succeed("Lighthouse audit complete");
      console.log(chalk.green("\n📊 Lighthouse Performance Report:"));
      console.log(lhResults);

      // AI Analysis
      spinner.start("Generating AI suggestions...");
      const allIssues = [
        ...results.split('\n').filter(Boolean),
        lhResults
      ];
      const aiFixes = await getAISuggestions(allIssues);
      spinner.succeed("AI analysis complete");

      console.log(chalk.magenta("\n🤖 AI-Powered Optimization Suggestions:"));
      console.log(aiFixes);

      console.log(chalk.gray("\n─".repeat(50)));
      console.log(chalk.blue("✨ Scan complete! Review the suggestions above to improve your app's performance."));
    } catch (err) {
      console.error(chalk.red("\n❌ Error:"), (err as Error).message);
      process.exit(1);
    }
  });

program.parse(process.argv);