import { loadConfig, type PerflensConfig } from '../../src/index.js';

async function main() {
  try {
    // Load base configuration
    const baseConfig = await loadConfig('./config.json');

    // Create environment-specific overrides
    const envOverrides: Partial<PerflensConfig> = {
      analysis: {
        maxFiles: process.env.NODE_ENV === 'production' ? 1000 : 500,
        targetDir: process.env.TARGET_DIR || './src',
      },
      lighthouse: {
        mobileEmulation: process.env.MOBILE === 'true',
        throttling: {
          network: (process.env.NETWORK_THROTTLE as '4G' | 'slow3G' | 'fast3G') || '4G',
        },
      },
    };

    // Merge configurations
    const finalConfig: PerflensConfig = {
      ...baseConfig,
      analysis: {
        ...baseConfig.analysis,
        ...envOverrides.analysis,
      },
      lighthouse: {
        ...baseConfig.lighthouse,
        ...envOverrides.lighthouse,
      },
    };

    // Log final configuration
    console.log('Final Configuration:');
    console.log('\nAnalysis Settings:');
    console.log(`- Max files: ${finalConfig.analysis?.maxFiles}`);
    console.log(`- Target directory: ${finalConfig.analysis?.targetDir}`);

    console.log('\nLighthouse Settings:');
    console.log(`- Mobile emulation: ${finalConfig.lighthouse?.mobileEmulation}`);
    console.log(`- Network throttle: ${finalConfig.lighthouse?.throttling?.network}`);

    // Example of using the configuration
    if (finalConfig.lighthouse?.mobileEmulation) {
      console.log('\n⚠️ Mobile emulation is enabled');
    }
  } catch (error) {
    console.error('Error loading configuration:', error);
  }
}

main();
