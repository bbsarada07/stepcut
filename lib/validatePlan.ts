import type { Box, PlannedStep } from "@/lib/types";

const MIN_STEP_SEC = 1.5;
const MAX_CAPTION_CHARS = 60;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN);
/** Truncate by code points so multi-byte scripts never split mid-character. */
const truncate = (s: string, n: number) => Array.from(s).slice(0, n).join("");

function validBoxes(v: unknown): Box[] {
  if (!Array.isArray(v)) return [];
  const out: Box[] = [];
  for (const b of v) {
    if (!Array.isArray(b) || b.length !== 4) continue;
    const [ymin, xmin, ymax, xmax] = b.map(num);
    if (![ymin, xmin, ymax, xmax].every((n) => Number.isFinite(n) && n >= 0 && n <= 1000)) continue;
    if (ymax <= ymin || xmax <= xmin) continue; // zero (or negative) area
    out.push([ymin, xmin, ymax, xmax]);
  }
  return out;
}

/**
 * Validate the model's plan. Returns null when the reply has no usable steps
 * array or fewer than 2 steps survive.
 */
export function validatePlan(raw: unknown, durationSec: number): { title: string; language: string; steps: PlannedStep[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.steps)) return null;

  const clamp = (t: number) => Math.min(durationSec, Math.max(0, t));
  const candidates = r.steps
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => {
      const captionEn = str(s.captionEn);
      const caption = str(s.caption);
      const sensitive = s.sensitive === true;
      return {
        startSec: clamp(num(s.startSec)),
        endSec: clamp(num(s.endSec)),
        captionEn: truncate(captionEn || caption, MAX_CAPTION_CHARS),
        caption: truncate(caption || captionEn, MAX_CAPTION_CHARS),
        sensitive,
        sensitiveLabel: sensitive ? truncate(str(s.sensitiveLabel) || "private data", 40) : "",
        boxes: sensitive ? validBoxes(s.boxes) : [],
      };
    })
    .filter((s) => Number.isFinite(s.startSec) && Number.isFinite(s.endSec) && s.captionEn)
    .sort((a, b) => a.startSec - b.startSec);

  const steps: PlannedStep[] = [];
  for (const s of candidates) {
    const prev = steps[steps.length - 1];
    // Overlap: the later step starts where the earlier one ends.
    if (prev && s.startSec < prev.endSec) s.startSec = prev.endSec;
    if (s.endSec - s.startSec < MIN_STEP_SEC) continue;
    steps.push({ id: "", ...s });
  }
  steps.forEach((s, i) => {
    s.id = `s${i + 1}`;
    s.startSec = Math.round(s.startSec * 100) / 100;
    s.endSec = Math.round(s.endSec * 100) / 100;
  });

  if (steps.length < 2) return null;
  return {
    title: truncate(str(r.title) || "Tutorial", 80),
    language: str(r.language) || "English",
    steps,
  };
}

/** Strip ``` fences (with or without a language tag) and parse. Throws SyntaxError on bad JSON. */
export function parseModelJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse((fenced ? fenced[1] : text).trim());
}
