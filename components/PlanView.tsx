"use client";

import { ShieldAlert, Sparkles } from "lucide-react";
import type { Language } from "@/lib/languages";
import type { FrameSample, Plan } from "@/lib/types";

export type Captions = Record<string, Record<string, string>>;

/** The sampled frame closest to a time. */
export function closestFrame(frames: FrameSample[], tSec: number) {
  let best = frames[0];
  for (const f of frames) if (Math.abs(f.tSec - tSec) < Math.abs(best.tSec - tSec)) best = f;
  return best;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

export function PlanView({
  plan,
  captions,
  lang,
  frames,
  modelUsed,
}: {
  plan: Plan;
  captions: Captions;
  lang: Language;
  frames: FrameSample[];
  modelUsed: string;
}) {
  return (
    <section className="flex flex-col gap-4" aria-label="AI plan">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
          <Sparkles size={13} /> AI plan · {plan.steps.length} steps · {lang.name}
        </span>
        <h2 className="font-heading text-3xl font-extrabold leading-tight tracking-tight">{plan.title}</h2>
      </div>

      <ol className="flex flex-col gap-3">
        {plan.steps.map((step, i) => {
          const thumb = closestFrame(frames, step.startSec);
          const caption = captions[lang.code]?.[step.id] ?? step.captionEn;
          return (
            <li
              key={step.id}
              className="card-in flex gap-3 rounded-2xl border border-fg/10 bg-fg/[0.03] p-3"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL thumbnail */}
              <img
                src={`data:image/jpeg;base64,${thumb.jpegBase64}`}
                alt=""
                className="h-24 w-16 shrink-0 rounded-lg bg-black object-cover ring-1 ring-white/10"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-fg/45">
                  <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-bg">{i + 1}</span>
                  {fmt(step.startSec)} – {fmt(step.endSec)}
                </span>
                <p
                  dir={lang.rtl ? "rtl" : "ltr"}
                  className="text-[15px] font-semibold leading-snug"
                  style={{ fontFamily: `"${lang.fontFamily}", var(--font-body), system-ui, sans-serif` }}
                >
                  {caption}
                </p>
                {lang.code !== "en" && <p className="text-[13px] leading-snug text-fg/50">{step.captionEn}</p>}
                {step.sensitive && (
                  <span className="mt-1 flex items-center gap-1.5 self-start rounded-full bg-amber/10 px-2.5 py-1 text-[12px] font-semibold text-amber">
                    <ShieldAlert size={13} /> Shows your {step.sensitiveLabel}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-[12px] text-fg/45">
        Planned by <span className="font-mono text-fg/70">{modelUsed}</span>
      </p>
    </section>
  );
}
