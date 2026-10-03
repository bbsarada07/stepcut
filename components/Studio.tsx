"use client";

import { useState } from "react";
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
import { Film, Languages, Pause, Play, ScanEye, ShieldCheck, Upload } from "lucide-react";
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
  const current: StageName = source ? "Preview" : "Request";

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
      const next: Source = { src: asset.src, assetId: asset.id, name: file.name, ...dims, durationSec: asset.durationSec };
      loadSource(next);
      setSource(next);
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
          <section className="rise relative flex flex-col items-center gap-5 md:sticky md:top-36">
            {!source && <FloatingChips />}
            <PhoneFrame aspect={stageSize.width / stageSize.height}>
              {/* Audio disabled: the app never plays sound. */}
              <Preview demuxerFactory={demuxerFactory} enableAudio={false} clearColor={[0, 0, 0, 1]} style={{ width: "100%", height: "100%" }} />
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
                  <input type="file" accept="video/*" className="sr-only" onChange={onPick} disabled={loading} />
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
                <p role="alert" className="rounded-2xl border border-fg/20 bg-fg/5 p-4 text-sm">
                  {error}
                </p>
              )}
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
