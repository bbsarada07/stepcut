"use client";

import { useEffect, useRef, useState } from "react";
import {
  EditorProvider,
  Preview,
  createDefaultDemuxerFactory,
  framesToTimecode,
  useMediaLibrary,
  usePlaybackStore,
  useTimelineEngine,
  useTracksStore,
  type InitialTrackConfig,
} from "@elah/editor";
import { Film, Languages, Loader2, Pause, Play, RotateCcw, ScanEye, ShieldCheck, Upload, WandSparkles } from "lucide-react";
import { PlanView, type Captions } from "@/components/PlanView";
import { MAX_DURATION_SEC, sampleFrames } from "@/lib/frames";
import { matchLanguage, type Language } from "@/lib/languages";
import type { FrameSample, Plan, PlanRequest, PlanResponse } from "@/lib/types";
import {
  Backdrop,
  EmptyScreen,
  Feature,
  FloatingChips,
  LanguageMarquee,
  LiveBadge,
  PhoneFrame,
  SpotCard,
  StageRail,
  StepLabel,
  Wordmark,
  type StageName,
} from "@/components/ui";

export const FPS = 30;

// Created once at module scope: it owns decoder state.
const demuxerFactory = createDefaultDemuxerFactory();

// One video track. No audio track anywhere in the app.
const INITIAL_TRACKS: InitialTrackConfig[] = [{ kind: "video", name: "Video" }];

export type Source = { src: string; assetId: string; name: string; width: number; height: number; durationSec: number };

export default function Studio() {
  return (
    // EditorProvider reads fps/stage/tracks once; the stage is resized per video with engine.setStage.
    <EditorProvider fps={FPS} stage={{ width: 1080, height: 1920 }} initialTracks={INITIAL_TRACKS}>
      <div className="elah-root min-h-dvh">
        <StudioInner />
      </div>
    </EditorProvider>
  );
}

function StudioInner() {
  const engine = useTimelineEngine();
  const { importFiles, getAsset } = useMediaLibrary();
  const stageSize = useTracksStore((s) => s.stage);
  const [source, setSource] = useState<Source | null>(null);
  const [request, setRequest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [work, setWork] = useState<{ kind: "idle" } | { kind: "sampling"; done: number; total: number } | { kind: "planning" }>({ kind: "idle" });
  const [planError, setPlanError] = useState<string | null>(null);
  const [frames, setFrames] = useState<FrameSample[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [captions, setCaptions] = useState<Captions>({});
  const [lang, setLang] = useState<Language | null>(null);
  const [modelUsed, setModelUsed] = useState("");
  const busy = work.kind !== "idle";
  const current: StageName = plan || busy ? "AI Plan" : "Request";
  const resultsRef = useRef<HTMLDivElement>(null);

  // Scroll to the results as soon as there is something to show there.
  useEffect(() => {
    if (plan || planError || work.kind === "planning") resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [plan, planError, work.kind]);

  async function makePlan() {
    if (!file || !source || busy) return;
    setPlanError(null);
    setPlan(null);
    try {
      setWork({ kind: "sampling", done: 0, total: 0 });
      const sampled = await sampleFrames(file, source.durationSec, (done, total) => setWork({ kind: "sampling", done, total }));
      setFrames(sampled);
      setWork({ kind: "planning" });
      const body: PlanRequest = { request: request.trim(), languageName: null, durationSec: source.durationSec, frames: sampled };
      const json = JSON.stringify(body);
      if (json.length > 4 * 1024 * 1024) throw new Error("This recording produced too much data. Try a shorter recording.");
      const res = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: json });
      const raw = await res.text();
      let data: { error?: string } & Partial<PlanResponse>;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Server error ${res.status}: ${raw.slice(0, 300) || res.statusText}`);
      }
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      const { plan: planned, modelUsed: used } = data as PlanResponse;

      // Caption store: English from captionEn, plus the plan's own language.
      const planLang = matchLanguage(planned.language);
      const next: Captions = { en: {} };
      if (planLang.code !== "en") next[planLang.code] = {};
      for (const st of planned.steps) {
        next.en[st.id] = st.captionEn;
        if (planLang.code !== "en") next[planLang.code][st.id] = st.caption;
      }
      setCaptions(next);
      setLang(planLang);
      setModelUsed(used);
      setPlan({
        title: planned.title,
        language: planLang.name,
        steps: planned.steps.map((st) => ({ id: st.id, startSec: st.startSec, endSec: st.endSec, captionEn: st.captionEn, sensitive: st.sensitive, sensitiveLabel: st.sensitiveLabel, boxes: st.boxes, keep: true, hide: true })),
      });
    } catch (err) {
      setPlanError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setWork({ kind: "idle" });
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const { imported, skipped } = await importFiles([file]);
      // Re-picking the same file is reported as a duplicate of the asset already imported.
      const dup = skipped[0]?.reason === "duplicate" && skipped[0].existingAssetId ? getAsset(skipped[0].existingAssetId) : undefined;
      const asset = imported[0] ?? dup;
      if (!asset) throw new Error("Couldn't read that video. Try an MP4 screen recording.");
      const dims = asset.width && asset.height ? { width: asset.width, height: asset.height } : await probeDims(asset.src);
      if (asset.durationSec > MAX_DURATION_SEC) {
        throw new Error(`This recording is ${Math.round(asset.durationSec)} seconds long. StepCut works with recordings up to 90 seconds.`);
      }
      const next: Source = { src: asset.src, assetId: asset.id, name: file.name, ...dims, durationSec: asset.durationSec };
      loadSource(next);
      setSource(next);
      setFile(file);
      setPlan(null);
      setFrames([]);
      setPlanError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function loadSource(s: Source) {
    const videoTrack = engine.getProject().tracks.find((t) => t.kind === "video");
    if (!videoTrack) throw new Error("No video track");
    const totalFrames = Math.max(1, Math.floor(s.durationSec * FPS));
    engine.batch(() => {
      // Stage = the source's exact pixel size, so the video fills it with no letterboxing.
      engine.setStage(s.width, s.height);
      for (const [trackId, clips] of Object.entries(engine.getProject().clips)) {
        for (const c of clips) engine.removeClip(c.id, trackId);
      }
      const clip = engine.addClip({
        type: "video",
        trackId: videoTrack.id,
        startFrame: 0,
        durationFrames: totalFrames,
        src: s.src,
        assetId: s.assetId,
        volume: 0, // source audio muted
      });
      engine.updateClip(clip.id, videoTrack.id, { sourceStartFrame: 0, sourceDurationFrames: totalFrames });
    }, "Load recording");
    usePlaybackStore.getState().setCurrentFrame(0);
  }

  return (
    <>
      <Backdrop />
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-10 sm:px-6">
        <header className="sticky top-0 z-30 -mx-4 flex flex-col gap-3 border-b border-fg/[0.06] bg-bg/70 px-4 pb-3 pt-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Wordmark />
            <LiveBadge />
          </div>
          <StageRail current={current} />
        </header>

        <div className="grid items-start gap-8 pt-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-12 md:pt-10">
          {/* Preview: on top on mobile, left column on desktop. */}
          <section className="rise relative flex w-full min-w-0 flex-col items-center gap-5 md:sticky md:top-36">
            {!source && <FloatingChips />}
            <PhoneFrame aspect={stageSize.width / stageSize.height}>
              {/* Audio disabled: the app never plays sound. */}
              <Preview
                demuxerFactory={demuxerFactory}
                enableAudio={false}
                clearColor={[0, 0, 0, 1]}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              />
              {!source && <EmptyScreen />}
            </PhoneFrame>
            {source && <Transport />}
          </section>

          {/* Plan side: a sheet below the preview on mobile, right column on desktop. */}
          <section className="flex min-w-0 flex-col gap-7">
            <div className="rise flex flex-col gap-4" style={{ animationDelay: "80ms" }}>
              <h1 className="font-heading text-[2.9rem] font-extrabold leading-[0.9] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
                Screen recording in.
                <br />
                <span className="text-glow relative inline-block text-accent">
                  Tutorial
                  <svg aria-hidden viewBox="0 0 300 20" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full text-accent">
                    <path d="M4 14 C 80 4, 200 4, 296 12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                  </svg>
                </span>{" "}
                out.
              </h1>
              <p className="max-w-md text-[15px] leading-relaxed text-fg/65 sm:text-base">
                Gemma reads your recording, cuts it into clear steps, captions them in the language your viewer reads, and covers private data on screen.
              </p>
            </div>

            <LanguageMarquee />

            <SpotCard
              className="rise -mx-4 flex flex-col gap-6 rounded-t-[2rem] border-t border-fg/10 bg-fg/[0.03] px-4 pb-6 pt-6 sm:-mx-6 sm:px-6 md:mx-0 md:rounded-[2rem] md:border md:p-7"
              delay={160}
            >
              <ul className="grid grid-cols-3 gap-2 text-[12px] text-fg/75">
                <Feature icon={<ScanEye size={18} />} label="Finds each step" />
                <Feature icon={<Languages size={18} />} label="Any language" />
                <Feature icon={<ShieldCheck size={18} />} label="Hides private data" />
              </ul>

              <div className="flex flex-col gap-2">
                <StepLabel n={1} text="Your screen recording" />
                <label
                  className={`relative flex min-h-24 cursor-pointer items-center gap-4 rounded-2xl p-4 ${
                    source ? "border border-accent/50 bg-accent/[0.07]" : "ants bg-bg/60"
                  }`}
                >
                  <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${source ? "glow-accent bg-accent text-bg" : "bg-accent/10 text-accent"}`}>
                    {source ? <Film size={22} /> : <Upload size={22} />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{loading ? "Opening your recording…" : source ? source.name : "Pick from your gallery"}</span>
                    <span className="text-[13px] text-fg/55">
                      {source ? `${source.width}×${source.height} · ${source.durationSec.toFixed(1)}s · tap to change` : "Phone screen recording, up to 90 seconds"}
                    </span>
                  </span>
                  <input type="file" accept="video/*" className="sr-only" onChange={onPick} disabled={loading || busy} />
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <StepLabel n={2} text="Who is it for, and in what language?" />
                <textarea
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  placeholder="Make a tutorial for my mom in Hindi"
                  rows={3}
                  className="resize-none rounded-2xl border border-fg/15 bg-bg/70 p-4 text-base leading-relaxed outline-none placeholder:text-fg/35 focus:border-accent focus:shadow-[0_0_0_4px_rgb(198_255_61/0.12)]"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={makePlan}
                disabled={!source || busy}
                className="glow-accent flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-5 font-heading text-lg font-bold text-bg disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                {busy ? <Loader2 size={20} className="animate-spin" /> : <WandSparkles size={20} />}
                Make tutorial
              </button>
              {!source && <p className="-mt-3 text-center text-[12px] text-fg/45">Pick a recording first</p>}

              <div ref={resultsRef} className="scroll-mt-40">
                {busy && (
                  <p className="flex items-center gap-2 rounded-2xl border border-fg/10 bg-bg/60 p-4 text-sm font-semibold">
                    <Loader2 size={16} className="animate-spin text-accent" />
                    {work.kind === "sampling" ? `Capturing frames ${work.done}/${work.total || "…"}` : "Reading your recording…"}
                  </p>
                )}
                {planError && !busy && (
                  <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
                    <p className="text-sm font-medium text-red-400">{planError}</p>
                    <button type="button" onClick={makePlan} className="flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-fg/25 px-4 text-sm font-semibold">
                      <RotateCcw size={16} /> Try again
                    </button>
                  </div>
                )}
                {plan && lang && !busy && <PlanView plan={plan} captions={captions} lang={lang} frames={frames} modelUsed={modelUsed} />}
              </div>
            </SpotCard>

            <p className="text-center text-[11px] tracking-wide text-fg/35 md:text-left">
              Gemma 4 through the Gemini API · Elah video engine · video never leaves your browser
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

function Transport() {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const toggle = usePlaybackStore((s) => s.togglePlayPause);
  const currentFrame = usePlaybackStore((s) => s.currentFrame);
  const totalFrames = useTracksStore((s) => s.totalFrames);
  const pct = totalFrames > 0 ? Math.min(100, (currentFrame / totalFrames) * 100) : 0;
  return (
    <div className="flex w-full max-w-xs items-center gap-3 rounded-full border border-fg/10 bg-fg/[0.04] py-1.5 pl-1.5 pr-4 backdrop-blur">
      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="glow-accent grid size-12 shrink-0 place-items-center rounded-full bg-accent text-bg"
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="translate-x-[1px]" />}
      </button>
      <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-fg/10">
        <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </span>
      <span className="shrink-0 font-mono text-[12px] tabular-nums text-fg/70">{framesToTimecode(currentFrame, FPS)}</span>
    </div>
  );
}

function probeDims(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight });
    v.onerror = () => reject(new Error("Couldn't read the video's size"));
    v.src = src;
  });
}
