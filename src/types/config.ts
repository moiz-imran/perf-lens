export type AIProvider = 'openai' | 'anthropic' | 'gemini';

export interface GlobalConfig {
  verbose?: boolean;  // Global verbose flag for all operations
}

export interface AIModelConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface PerformanceThresholds {
  performance?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  totalBlockingTime?: number;
  cumulativeLayoutShift?: number;
  speedIndex?: number;
  timeToInteractive?: number;
}

export interface BundleThresholds {
  maxBundleSize?: string;
  maxChunkSize?: string;
  maxAssetSize?: string;
  maxImageSize?: string;
  maxFontSize?: string;
}

export interface AnalysisConfig {
  maxFiles?: number;
  batchSize?: number;
  maxFileSize?: number;
  batchDelay?: number;
  targetDir?: string;  // Directory to scan, relative to cwd
  include?: string[];  // File patterns to include (e.g. ['**/*.ts', '**/*.tsx'])
  ignore?: string[];   // File patterns to ignore
}

export interface LighthouseConfig {
  port?: number;
  mobileEmulation?: boolean;
  throttling?: {
    cpu?: number;
    network?: 'slow3G' | 'fast3G' | '4G' | 'none';
  };
  timeout?: number;
  retries?: number;
}

export interface PerflensConfig extends GlobalConfig {
  // Performance thresholds
  thresholds?: PerformanceThresholds;

  // Bundle size thresholds
  bundleThresholds?: BundleThresholds;

  // Analysis configuration
  analysis?: AnalysisConfig;

  // Lighthouse configuration
  lighthouse?: LighthouseConfig;

  // AI model configuration
  ai?: AIModelConfig;

  // Patterns to always ignore (in addition to .perflensignore)
  ignore?: string[];

  // Custom rules and their severity
  rules?: {
    [key: string]: {
      severity: 'error' | 'warning' | 'info';
      threshold?: number | string;
      options?: Record<string, any>;
    };
  };

  // Output configuration
  output?: {
    format?: 'md' | 'html';
    directory?: string;
    filename?: string;
    includeTimestamp?: boolean;
  };
}