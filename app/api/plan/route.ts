import { NextResponse } from "next/server";
import { Type, type Schema } from "@google/genai";
import { ModelCallError, VISION_MODEL, callModel, fallbackFor } from "@/lib/models";
import { parseModelJson, validatePlan } from "@/lib/validatePlan";
import type { FrameSample, PlanResponse } from "@/lib/types";

export const maxDuration = 120;

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_ATTEMPTS = 2;
const NO_STEPS = "Couldn't find clear steps. Try a shorter recording.";

const PLAN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    language: { type: Type.STRING },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startSec: { type: Type.NUMBER },
          endSec: { type: Type.NUMBER },
          captionEn: { type: Type.STRING },
          caption: { type: Type.STRING },
          sensitive: { type: Type.BOOLEAN },
          sensitiveLabel: { type: Type.STRING },
          boxes: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.NUMBER } } },
        },
        required: ["startSec", "endSec", "captionEn", "caption", "sensitive", "sensitiveLabel", "boxes"],
      },
    },
  },
  required: ["title", "language", "steps"],
};

// Whether each model accepts JSON-mode config. Remembered across requests so a
// rejection costs an attempt only once per server instance.
const jsonModeWorks = new Map<string, boolean>();

function isJsonConfigRejection(err: ModelCallError) {
  return err.status === 400 && /json|mime|schema|structured/i.test(err.message);
}

function systemInstruction(request: string, languageName: string | null) {
  const languageRule = languageName
    ? `Write the captions in ${languageName}.`
    : "Write the captions in the language the request asks for; if none is named, use English.";
  return `You turn a phone screen recording into a tutorial. You receive frames with timestamps. The user's request: ${request}. ${languageRule} Follow the request for tone and audience. Identify the distinct actions the user performs, in order. Return 3 to 8 steps. Each step covers the time range where that action is visible, at least 1.5 seconds, no overlaps, within the video duration. Skip loading screens, idle time and repeated frames. For each step write captionEn in English and caption in the caption language. Each is an instruction to the viewer, at most 8 words or 40 characters, naming the exact button or field shown on screen. Keep app names, button labels and numbers exactly as they appear on screen. For each step, check whether the screen shows private data: account balance, account or card number, phone number, email, OTP, full name, address, UPI ID. If so set sensitive true, give a short English sensitiveLabel, and give one box per private item in boxes as [ymin, xmin, ymax, xmax], each 0 to 1000 relative to the frame. If unsure of a position, leave boxes empty. Return JSON only: { title, language (English name of the caption language), steps: [{ startSec, endSec, captionEn, caption, sensitive, sensitiveLabel, boxes }] }. Answer immediately. Do not think step by step and do not write any reasoning; output only the JSON.`;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return bad("This recording produced too much data. Try a shorter recording.", 413);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Request body is not valid JSON.");
  }

  const request = typeof body.request === "string" ? body.request.trim().slice(0, 500) : "";
  const languageName = typeof body.languageName === "string" && body.languageName.trim() ? body.languageName.trim().slice(0, 60) : null;
  const durationSec = Number(body.durationSec);
  const frames = body.frames as FrameSample[];
  if (!Number.isFinite(durationSec) || durationSec <= 0) return bad("Missing video duration.");
  if (durationSec > 90.5) return bad("Recordings must be 90 seconds or shorter.");
  if (
    !Array.isArray(frames) ||
    frames.length === 0 ||
    frames.length > 20 ||
    !frames.every((f) => f && Number.isFinite(f.tSec) && typeof f.static === "boolean" && typeof f.jpegBase64 === "string" && f.jpegBase64.length > 0)
  ) {
    return bad("Frames are missing or malformed.");
  }

  const parts = frames.flatMap((f) => [
    { text: `Frame at ${f.tSec}s (static: ${f.static})` },
    { inlineData: { mimeType: "image/jpeg", data: f.jpegBase64 } },
  ]);
  const system = systemInstruction(request, languageName);

  let model = VISION_MODEL;
  let lastProblem: "steps" | "api" = "api";
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const useJson = jsonModeWorks.get(model) !== false;
    try {
      const text = await callModel(model, {
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: system,
          ...(useJson ? { responseMimeType: "application/json", responseSchema: PLAN_SCHEMA } : {}),
        },
      });
      if (useJson) jsonModeWorks.set(model, true);
      let parsed: unknown;
      try {
        parsed = parseModelJson(text);
      } catch (parseErr) {
        console.error(`[plan] ${model} attempt ${attempt}: reply is not valid JSON. Raw reply:
${text}`);
        throw parseErr;
      }
      const plan = validatePlan(parsed, durationSec);
      if (plan) return NextResponse.json({ plan, modelUsed: model } satisfies PlanResponse);
      console.error(`[plan] ${model} attempt ${attempt}: fewer than 2 valid steps. Raw reply:
${text}`);
      lastProblem = "steps";
      model = fallbackFor(model);
    } catch (err) {
      if (err instanceof SyntaxError) {
        // Reply was not valid JSON.
        lastProblem = "steps";
        model = fallbackFor(model);
      } else if (err instanceof ModelCallError) {
        lastProblem = "api";
        lastError = err.message;
        console.error(`[plan] ${model} attempt ${attempt} failed: ${err.message}`);
        if (useJson && isJsonConfigRejection(err)) {
          // Retry the same model without JSON mode; fences are stripped on parse.
          jsonModeWorks.set(model, false);
        } else if (err.retryable) {
          model = fallbackFor(model);
        } else {
          return bad(`Gemma couldn't process this recording. ${err.message}`, 502);
        }
      } else {
        return bad(`Planning failed: ${(err as Error).message}`, 500);
      }
    }
  }

  if (lastProblem === "steps") return bad(NO_STEPS, 422);
  return bad(`Gemma is busy right now. Please try again. (${lastError})`, 503);
}
