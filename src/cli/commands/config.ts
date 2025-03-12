import { Command } from 'commander';
import chalk from 'chalk';
import { setApiKey, getApiKey } from '../../utils/ai.js';
import type { AIProvider } from '../../types/config.js';

export function createConfigCommand(): Command {
  const configCommand = new Command('config').description('Configure PerfLens settings');

  configCommand
    .addCommand(
      new Command('set-key')
        .description('Set your AI provider API key')
        .argument('<key>', 'Your API key')
        .option('--provider <provider>', 'AI provider (openai, anthropic, or gemini)', 'openai')
        .action((key, options) => {
          try {
            setApiKey(key, options.provider as AIProvider);
            console.log(
              chalk.green(`${options.provider.toUpperCase()} API key saved successfully!`)
            );
          } catch (error) {
            console.error(
              chalk.red('Error saving API key:'),
              error instanceof Error ? error.message : error
            );
            process.exit(1);
          }
        })
    )
    .addCommand(
      new Command('get-key')
        .description('Get your currently configured API key')
        .option('--provider <provider>', 'AI provider (openai, anthropic, or gemini)', 'openai')
        .action(options => {
          try {
            const key = getApiKey(options.provider as AIProvider);
            if (key) {
              const maskedKey = `${key.slice(0, 4)}...${key.slice(-4)}`;
              console.log(
                chalk.blue(`Current ${options.provider.toUpperCase()} API key:`, maskedKey)
              );
            } else {
              console.log(
                chalk.yellow(`No API key configured for ${options.provider.toUpperCase()}`)
              );
              console.log(
                chalk.gray(
                  `To set an API key, use:\nperf-lens config set-key YOUR_API_KEY --provider ${options.provider}`
                )
              );
            }
          } catch (error) {
            console.error(
              chalk.red('Error getting API key:'),
              error instanceof Error ? error.message : error
            );
            process.exit(1);
          }
        })
    );

  return configCommand;
}
