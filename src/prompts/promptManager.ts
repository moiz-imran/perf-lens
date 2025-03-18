import { getPromptTemplateAsync, type PromptKey, PROMPT_KEYS } from './promptConfig.js';

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
   * Loads prompts asynchronously from S3 or local files
   */
  private async loadPromptsAsync(): Promise<void> {
    if (this.initialized) return;

    // Load prompts from S3 or local files
    const promptKeys = Object.values(PROMPT_KEYS) as PromptKey[];
    const loadPromises = promptKeys.map(async key => {
      const content = await getPromptTemplateAsync(key);
      this.prompts.set(key, content);
    });

    await Promise.all(loadPromises);
    this.initialized = true;
  }

  /**
   * Gets a prompt by its key
   * @param key - The key of the prompt to retrieve
   * @returns The prompt content
   * @throws Error if the prompt is not found
   */
  public async getPromptAsync(key: PromptKey): Promise<string> {
    if (!this.initialized) {
      await this.loadPromptsAsync();
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
      this.loadPromptsAsync();
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
      this.loadPromptsAsync();
    }
    return this.prompts.has(key);
  }

  /**
   * Gets all available prompt keys
   * @returns Array of prompt keys
   */
  public getPromptKeys(): PromptKey[] {
    if (!this.initialized) {
      this.loadPromptsAsync();
    }
    return Array.from(this.prompts.keys());
  }
}
