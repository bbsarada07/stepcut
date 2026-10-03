// Shared Gemma 4 model config. Server-only: every API route imports this, and
// nothing in the client may import it (it reads GEMINI_API_KEY).
import { GoogleGenAI, ApiError, type GenerateContentParameters } from "@google/genai";

export const VISION_MODEL = process.env.GEMMA_VISION_MODEL || "gemma-4-31b-it";
export const TEXT_MODEL = process.env.GEMMA_TEXT_MODEL || "gemma-4-26b-a4b-it";

// Only Gemma 4 may ever be called. Evaluated when a route first loads this module.
for (const m of [VISION_MODEL, TEXT_MODEL]) {
  if (!m.includes("gemma-4")) {
    throw new Error(`Configured model "${m}" is not a Gemma 4 model`);
  }
}

/** Each role falls back to the other role's model. */
export function fallbackFor(model: string): string {
  return model === VISION_MODEL ? TEXT_MODEL : VISION_MODEL;
}

// Under event load Gemma can take well over 25s; 55s keeps two attempts inside the route limit.
export const CALL_TIMEOUT_MS = 55_000;

let client: GoogleGenAI | null = null;
export function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set on the server");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export class ModelCallError extends Error {
  constructor(
    message: string,
    /** Rate limit, server error or timeout: worth one retry on the fallback model. */
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** One model call, aborted after 25 seconds. Returns the reply text. */
export async function callModel(
  model: string,
  params: Omit<GenerateContentParameters, "model">,
): Promise<string> {
  if (!model.includes("gemma-4")) throw new ModelCallError(`Refusing non-Gemma-4 model "${model}"`, false);
  const ai = getAI();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await ai.models.generateContent({
      ...params,
      model,
      config: { ...params.config, abortSignal: controller.signal },
    });
    return res.text ?? "";
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ModelCallError(`${model} timed out after ${CALL_TIMEOUT_MS / 1000}s`, true);
    }
    if (err instanceof ApiError) {
      const retryable = err.status === 429 || err.status >= 500;
      throw new ModelCallError(`${model}: ${err.message}`, retryable, err.status);
    }
    throw new ModelCallError(`${model}: ${(err as Error).message}`, false);
  } finally {
    clearTimeout(timer);
  }
}
