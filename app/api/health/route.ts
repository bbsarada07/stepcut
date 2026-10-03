import { NextResponse } from "next/server";
import { callModel, getAI } from "@/lib/models";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 64x64 solid red JPEG.
const RED_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCABAAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDkqKKK+dP2cKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//Z";

const TEXT_CHECK_MODELS = ["gemma-4-31b-it", "gemma-4-26b-a4b-it"];
const IMAGE_CHECK_MODEL = "gemma-4-31b-it";

async function timed(fn: () => Promise<string>) {
  const t0 = Date.now();
  try {
    const reply = await fn();
    return { ok: true, reply, ms: Date.now() - t0, error: null as string | null };
  } catch (err) {
    return { ok: false, reply: null as string | null, ms: Date.now() - t0, error: (err as Error).message };
  }
}

async function listGemmaModels() {
  try {
    const pager = await getAI().models.list({ config: { pageSize: 1000 } });
    const names: string[] = [];
    for await (const m of pager) {
      if (m.name?.includes("gemma-4")) names.push(m.name.replace(/^models\//, ""));
    }
    return { models: names, error: null as string | null };
  } catch (err) {
    return { models: [] as string[], error: (err as Error).message };
  }
}

export async function GET() {
  const [listing, textChecks, imageCheck] = await Promise.all([
    listGemmaModels(),
    Promise.all(
      TEXT_CHECK_MODELS.map(async (model) => ({
        model,
        ...(await timed(() =>
          callModel(model, { contents: [{ role: "user", parts: [{ text: "Reply with the word OK" }] }] }),
        )),
      })),
    ),
    timed(() =>
      callModel(IMAGE_CHECK_MODEL, {
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: RED_JPEG_BASE64 } },
              { text: "Describe this image in five words" },
            ],
          },
        ],
      }),
    ),
  ]);

  return NextResponse.json({
    gemmaModels: listing.models,
    gemmaModelsError: listing.error,
    textChecks,
    imageCheck,
  });
}
