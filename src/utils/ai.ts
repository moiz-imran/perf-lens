import OpenAI from "openai";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      resolve();
    }, ms);

    // Cleanup on rejection
    timer.unref?.(); // Optional cleanup for Node.js
  });
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let retries = 0;
  let currentDelay = initialDelay;
  let timer: NodeJS.Timeout | null = null;

  const cleanup = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  try {
    while (true) {
      try {
        return await fn();
      } catch (error) {
        if (error instanceof OpenAI.APIError && error.status === 429) {
          retries++;
          if (retries >= maxRetries) {
            throw error;
          }
          currentDelay = initialDelay * Math.pow(2, retries - 1);
          console.log(`Rate limited. Retrying in ${currentDelay}ms...`);
          await sleep(currentDelay);
          continue;
        }
        throw error;
      }
    }
  } finally {
    cleanup();
  }
}

export async function getAISuggestions(issues: string[]): Promise<string> {
  if (!issues || issues.length === 0) return "✅ No optimizations needed.";

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not found. Please set OPENAI_API_KEY environment variable.");
  }

  try {
    const openai = new OpenAI({ apiKey });
    const prompt = `Briefly analyze these frontend performance issues and suggest key fixes (be concise):\n\n${issues.join("\n")}`;

    const completion = await retryWithBackoff(async () => {
      return await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "gpt-3.5-turbo",
        temperature: 0.5,
        max_tokens: 50,
        presence_penalty: -0.5
      });
    });

    return completion.choices[0].message.content || "No suggestions available.";
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        console.error("Rate limit details:", {
          status: error.status,
          message: error.message,
          type: error.type,
          code: error.code
        });
        return "⚠️ Rate limit reached after retries. Please wait a few minutes before trying again.";
      }
      throw new Error(`AI API Error: ${error.message} (Type: ${error.type}, Code: ${error.code})`);
    }
    throw error;
  }
}