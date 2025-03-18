import { DEFAULT_PROMPTS, type PromptKey } from './promptConfig.js';

/**
 * Manages system prompts for AI interactions
 */
export class PromptManager {
  private static instance: PromptManager;
  private prompts: Map<PromptKey, string>;
  private initialized: boolean;

  private constructor() {
    this.prompts = new Map();
    this.initialized = false;
  }

  /**
   * Gets the singleton instance of PromptManager
   */
  public static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  /**
   * Loads prompts from the default configuration
   */
  private loadPrompts(): void {
    if (this.initialized) return;

    // Load default prompts
    Object.entries(DEFAULT_PROMPTS).forEach(([key, content]) => {
      this.prompts.set(key as PromptKey, content);
    });

    this.initialized = true;
  }

  /**
   * Gets a prompt by its key
   * @param key - The key of the prompt to retrieve
   * @returns The prompt content
   * @throws Error if the prompt is not found
   */
  public getPrompt(key: PromptKey): string {
    if (!this.initialized) {
      this.loadPrompts();
    }

    const prompt = this.prompts.get(key);
    if (!prompt) {
      throw new Error(`Prompt not found for key: ${key}`);
    }

    return prompt;
  }

  /**
   * Updates a prompt's content
   * @param key - The key of the prompt to update
   * @param content - The new content for the prompt
   */
  public updatePrompt(key: PromptKey, content: string): void {
    if (!this.initialized) {
      this.loadPrompts();
    }

    this.prompts.set(key, content);
  }

  /**
   * Checks if a prompt exists
   * @param key - The key to check
   * @returns True if the prompt exists
   */
  public hasPrompt(key: PromptKey): boolean {
    if (!this.initialized) {
      this.loadPrompts();
    }
    return this.prompts.has(key);
  }

  /**
   * Gets all available prompt keys
   * @returns Array of prompt keys
   */
  public getPromptKeys(): PromptKey[] {
    if (!this.initialized) {
      this.loadPrompts();
    }
    return Array.from(this.prompts.keys());
  }
}
