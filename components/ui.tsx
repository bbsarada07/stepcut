"use client";

import { EyeOff, Languages, Play, Scissors } from "lucide-react";
import { LANGUAGES } from "@/lib/languages";

export const STAGES = ["Request", "AI Plan", "Preview", "Decide"] as const;
export type StageName = (typeof STAGES)[number];

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <span className="blob left-[-10%] top-[-15%] size-[38rem] bg-accent/[0.13]" />
      <span className="blob bottom-[-20%] right-[-10%] size-[32rem] bg-accent/[0.07]" style={{ animationDelay: "-9s" }} />
      <span
        className="absolute bottom-[-4vw] left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-heading text-[24vw] font-extrabold leading-none tracking-tighter text-transparent"
        style={{ WebkitTextStroke: "1px rgb(242 240 234 / 0.05)" }}
      >
        STEPCUT
      </span>
    </div>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 font-heading text-xl font-extrabold tracking-tight">
      <span className="glow-accent grid size-8 place-items-center rounded-lg bg-accent text-bg">
        {/* A frame with a cut through it. */}
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <rect x="4" y="3" width="16" height="18" rx="3" />
          <path d="M2 14 L22 10" />
        </svg>
      </span>
      <span>
        Step<span className="text-accent">Cut</span>
      </span>
    </span>
  );
}

export function LiveBadge() {
  return (
    <span className="flex items-center gap-2 rounded-full border border-fg/10 bg-fg/[0.04] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-fg/70">
      <span className="live-dot size-1.5 rounded-full bg-accent" />
      Gemma 4 × Elah
    </span>
  );
}

export function StageRail({ current }: { current: StageName }) {
  const idx = STAGES.indexOf(current);
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Progress">
      {STAGES.map((s, i) => {
        const lit = i === idx;
        const done = i < idx;
        return (
          <li key={s} className="flex flex-col gap-1.5" aria-current={lit ? "step" : undefined}>
            <span className={`h-1 rounded-full ${lit ? "glow-accent bg-accent" : done ? "bg-accent/45" : "bg-fg/12"}`} />
            <span className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${lit ? "text-accent" : done ? "text-fg/70" : "text-fg/35"}`}>
              {lit ? <span className="live-dot size-1.5 shrink-0 rounded-full bg-accent" /> : <span className="tabular-nums opacity-60">0{i + 1}</span>}
              <span className="truncate">{s}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function PhoneFrame({ aspect, children }: { aspect: number; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="phone-halo" aria-hidden />
      <span className="phone-rim" aria-hidden />
      <div className="phone-bezel relative rounded-[2.6rem] px-2.5 pb-2.5 pt-7">
        {/* Side buttons */}
        <span className="absolute -left-[3px] top-24 h-10 w-[3px] rounded-l bg-[#2c2c31]" />
        <span className="absolute -left-[3px] top-36 h-14 w-[3px] rounded-l bg-[#2c2c31]" />
        <span className="absolute -right-[3px] top-28 h-16 w-[3px] rounded-r bg-[#2c2c31]" />
        {/* Island sits on the bezel, above the screen, so it never hides video. */}
        <span className="absolute left-1/2 top-2.5 h-[14px] w-20 -translate-x-1/2 rounded-full bg-black ring-1 ring-white/5" />
        {/* The screen has the stage's aspect ratio, so Preview fits with no letterboxing. */}
        <div
          className="relative overflow-hidden rounded-[2rem] bg-black ring-1 ring-white/5"
          style={{ aspectRatio: String(aspect), width: `min(calc(100vw - 3.5rem), calc(min(60dvh, 620px) * ${aspect}))` }}
        >
          {children}
          <span className="phone-sheen" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function EmptyScreen() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgb(198_255_61/0.14),transparent_65%)]">
      {/* Abstract app skeleton being scanned. */}
      <div className="absolute inset-x-5 top-6 flex flex-col gap-3 opacity-40">
        <span className="h-3 w-1/3 rounded-full bg-fg/25" />
        <span className="h-20 rounded-2xl bg-fg/10" />
        <span className="h-3 w-2/3 rounded-full bg-fg/15" />
        <span className="h-3 w-1/2 rounded-full bg-fg/15" />
        <span className="mt-2 grid grid-cols-3 gap-2">
          <span className="aspect-square rounded-xl bg-fg/10" />
          <span className="aspect-square rounded-xl bg-fg/10" />
          <span className="aspect-square rounded-xl bg-fg/10" />
        </span>
        <span className="h-10 rounded-xl bg-fg/10" />
      </div>
      <span className="scan" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black via-black/85 to-transparent px-6 pb-8 pt-16 text-center">
        <span className="glow-accent grid size-12 place-items-center rounded-full bg-accent text-bg">
          <Play size={20} fill="currentColor" className="translate-x-[1px]" />
        </span>
        <span className="font-heading text-lg font-bold">Your tutorial plays here</span>
        <span className="text-[13px] text-fg/55">Pick a recording to start</span>
      </div>
    </div>
  );
}

export function FloatingChips() {
  const chip =
    "float absolute z-10 hidden items-center gap-2 rounded-2xl border border-fg/10 bg-bg/80 px-3 py-2 text-[12px] font-semibold shadow-2xl backdrop-blur-md lg:flex";
  return (
    <>
      <span className={`${chip} left-0 top-[18%]`}>
        <Scissors size={14} className="text-accent" /> Cuts dead time
      </span>
      <span className={`${chip} right-0 top-[44%]`} style={{ animationDelay: "-1.6s" }}>
        <EyeOff size={14} className="text-accent" /> Covers private data
      </span>
      <span className={`${chip} bottom-[16%] left-2`} style={{ animationDelay: "-3.2s" }}>
        <Languages size={14} className="text-accent" /> हिन्दी · తెలుగు · 中文
      </span>
    </>
  );
}

export function LanguageMarquee() {
  const items = [...LANGUAGES, ...LANGUAGES];
  return (
    <div className="rise marquee -mx-4 overflow-hidden py-1 sm:-mx-6 md:mx-0" style={{ animationDelay: "120ms" }} aria-label="Caption languages">
      <div className="marquee-track gap-2">
        {items.map((l, i) => (
          <span
            key={i}
            aria-hidden={i >= LANGUAGES.length}
            dir={l.rtl ? "rtl" : "ltr"}
            className="shrink-0 rounded-full border border-fg/10 bg-fg/[0.03] px-3.5 py-1.5 text-[13px] font-medium text-fg/70"
          >
            {l.nativeName}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A card with a lime spotlight that follows the pointer. */
export function SpotCard({ className, delay = 0, children }: { className: string; delay?: number; children: React.ReactNode }) {
  return (
    <div
      className={`spot ${className}`}
      style={{ animationDelay: `${delay}ms` }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}

export function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex flex-col items-start gap-2 rounded-2xl border border-fg/10 bg-bg/60 p-3">
      <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent">{icon}</span>
      <span className="font-semibold leading-tight">{label}</span>
    </li>
  );
}

export function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <span className="flex items-center gap-2 text-[13px] font-semibold text-fg/85">
      <span className="grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold tabular-nums text-bg">{n}</span>
      {text}
    </span>
  );
}
