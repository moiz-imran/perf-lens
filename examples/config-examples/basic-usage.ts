import { loadConfig, type PerflensConfig } from '../../src/index.js';

async function main() {
  try {
    // Load configuration from a config file
    const config = await loadConfig('./config.json');

    // Access configuration values with type safety
    console.log('Analysis Settings:');
    console.log(`- Max files: ${config.analysis?.maxFiles}`);
    console.log(`- Target directory: ${config.analysis?.targetDir}`);
    console.log(`- Batch size: ${config.analysis?.batchSize}`);

    // Override specific settings
    const customConfig: PerflensConfig = {
      ...config,
      analysis: {
        ...config.analysis,
        maxFiles: 1000,
        targetDir: './src'
      }
    };

    console.log('\nCustomized Settings:');
    console.log(`- Max files: ${customConfig.analysis?.maxFiles}`);
    console.log(`- Target directory: ${customConfig.analysis?.targetDir}`);

  } catch (error) {
    console.error('Error loading configuration:', error);
  }
}

main();