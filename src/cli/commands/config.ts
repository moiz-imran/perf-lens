import { Command } from 'commander';
import chalk from 'chalk';
import { setApiKey, getApiKey } from '../../utils/ai.js';

export function createConfigCommand(): Command {
  const configCommand = new Command('config').description('Configure PerfLens settings');

  configCommand
    .addCommand(
      new Command('set-key')
        .description('Set your Anthropic API key')
        .argument('<key>', 'Your API key')
        .action(key => {
          try {
            setApiKey(key);
            console.log(chalk.green('Anthropic API key saved successfully!'));
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
      new Command('get-key').description('Show the currently configured API key').action(() => {
        const key = getApiKey();
        if (key) {
          const maskedKey = `${key.slice(0, 4)}...${key.slice(-4)}`;
          console.log(chalk.blue('Current Anthropic API key:', maskedKey));
        } else {
          console.log(chalk.yellow('No API key configured'));
          console.log(
            chalk.gray(
              'To set an API key, use:\nperf-lens config set-key YOUR_API_KEY\nor set the ANTHROPIC_API_KEY environment variable.'
            )
          );
        }
      })
    );

  return configCommand;
}
