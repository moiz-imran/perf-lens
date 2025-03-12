/**
 * AI provider types
 */
export type AIProvider = 'openai' | 'anthropic' | 'gemini';

/**
 * Network throttle types
 */
export type NetworkThrottle = 'slow3G' | 'fast3G' | '4G' | 'none';

/**
 * Global configuration
 */
export interface GlobalConfig {
  verbose?: boolean; // Global verbose flag for all operations
}

/**
 * AI model configuration
 */
export interface AIModelConfig {
  provider: AIProvider;
  model: string;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
}

/**
 * Performance thresholds
 */
export interface PerformanceThresholds {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  tti?: number; // Time to Interactive
  tbt?: number; // Total Blocking Time
  speedIndex?: number;
  performance?: number;
}

/**
 * Bundle size thresholds
 */
export interface BundleThresholds {
  maxInitialSize?: string; // e.g., '200kb'
  maxChunkSize?: string; // e.g., '100kb'
  maxAsyncChunks?: number;
  maxTotalSize?: string; // e.g., '1mb'
}

/**
 * Analysis configuration
 */
export interface AnalysisConfig {
  targetDir?: string;
  maxFiles?: number;
  batchSize?: number;
  maxFileSize?: number;
  batchDelay?: number;
  ignore?: string[];
  include?: string[];
}

/**
 * Lighthouse configuration
 */
export interface LighthouseConfig {
  port?: number;
  mobileEmulation?: boolean;
  throttling?: {
    cpu?: number; // CPU throttle percentage
    network?: NetworkThrottle;
  };
  timeout?: number;
  retries?: number;
}

/**
 * Output configuration
 */
export interface OutputConfig {
  directory?: string;
  filename?: string;
  format?: 'md' | 'html';
  includeTimestamp?: boolean;
}

/**
 * Main PerfLens configuration
 */
export interface PerflensConfig extends GlobalConfig {
  ai?: AIModelConfig;
  thresholds?: PerformanceThresholds;
  bundleThresholds?: BundleThresholds;
  analysis?: AnalysisConfig;
  lighthouse?: LighthouseConfig;
  output?: OutputConfig;
}
