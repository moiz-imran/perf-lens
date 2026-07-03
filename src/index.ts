#!/usr/bin/env node

import { config } from 'dotenv';
config();

import { Command } from 'commander';
import { createRequire } from 'module';
import { createConfigCommand, createScanCommand } from './cli/commands/index.js';

const { version } = createRequire(import.meta.url)('../package.json');

// Export only what's necessary for external use
export type { PerflensConfig } from './types/index.js';
export { loadConfig } from './utils/config.js';

const program = new Command();
program
  .name('perf-lens')
  .description('Performance analysis tool combining Lighthouse audits with static code analysis')
  .version(version);

// Add commands
program.addCommand(createConfigCommand());
program.addCommand(createScanCommand());

// Default command
program.action(() => {
  program.help();
});

program.parse(process.argv);
