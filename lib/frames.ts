import type { FrameSample } from "@/lib/types";

export const MAX_DURATION_SEC = 90;
const MAX_FRAMES = 20;
const FRAME_WIDTH = 640;
const JPEG_QUALITY = 0.6;
const STATIC_THRESHOLD = 4; // mean absolute difference on a 0..255 scale
const DIFF_SIZE = 32;

/** One frame per second, at most 20; longer videos widen the interval evenly. */
export function sampleTimes(durationSec: number): number[] {
  let count = Math.floor(durationSec) + 1;
  let interval = 1;
  if (count > MAX_FRAMES) {
    count = MAX_FRAMES;
    interval = durationSec / MAX_FRAMES;
  }
  const last = Math.max(0, durationSec - 0.05);
  return Array.from({ length: count }, (_, i) => Math.round(Math.min(i * interval, last) * 100) / 100);
}

function waitFor(video: HTMLVideoElement, event: "loadeddata" | "seeked", ms = 8000) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => done(new Error("The video took too long to load a frame.")), ms);
    const ok = () => done();
    const fail = () => done(new Error("The browser couldn't decode this video."));
    function done(err?: Error) {
      clearTimeout(timer);
      video.removeEventListener(event, ok);
      video.removeEventListener("error", fail);
      if (err) reject(err);
      else resolve();
    }
    video.addEventListener(event, ok);
    video.addEventListener("error", fail);
  });
}

export async function sampleFrames(
  file: File,
  durationSec: number,
  onProgress?: (done: number, total: number) => void,
): Promise<FrameSample[]> {
  if (durationSec > MAX_DURATION_SEC) {
    throw new Error(`This recording is ${Math.round(durationSec)} seconds long. StepCut works with recordings up to 90 seconds.`);
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  // Hidden but attached: some mobile browsers won't decode frames for a detached element.
  Object.assign(video.style, { position: "fixed", left: "-9999px", top: "0", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(video);

  try {
    const loaded = waitFor(video, "loadeddata");
    video.src = url;
    await loaded;

    const vw = video.videoWidth || FRAME_WIDTH;
    const vh = video.videoHeight || FRAME_WIDTH;
    const canvas = document.createElement("canvas");
    canvas.width = FRAME_WIDTH;
    canvas.height = Math.round((FRAME_WIDTH * vh) / vw);
    const ctx = canvas.getContext("2d")!;
    const small = document.createElement("canvas");
    small.width = DIFF_SIZE;
    small.height = DIFF_SIZE;
    const sctx = small.getContext("2d", { willReadFrequently: true })!;

    const times = sampleTimes(durationSec);
    const frames: FrameSample[] = [];
    let prevGrey: Float32Array | null = null;

    for (let i = 0; i < times.length; i++) {
      const seeked = waitFor(video, "seeked");
      video.currentTime = times[i];
      await seeked;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const jpegBase64 = canvas.toDataURL("image/jpeg", JPEG_QUALITY).split(",")[1];

      // Dead-time detection: 32x32 greyscale, mean absolute difference from the previous frame.
      sctx.drawImage(video, 0, 0, DIFF_SIZE, DIFF_SIZE);
      const px = sctx.getImageData(0, 0, DIFF_SIZE, DIFF_SIZE).data;
      const grey = new Float32Array(DIFF_SIZE * DIFF_SIZE);
      for (let p = 0; p < grey.length; p++) grey[p] = 0.299 * px[p * 4] + 0.587 * px[p * 4 + 1] + 0.114 * px[p * 4 + 2];
      let isStatic = false;
      if (prevGrey) {
        let sum = 0;
        for (let p = 0; p < grey.length; p++) sum += Math.abs(grey[p] - prevGrey[p]);
        isStatic = sum / grey.length < STATIC_THRESHOLD;
      }
      prevGrey = grey;

      frames.push({ tSec: times[i], static: isStatic, jpegBase64 });
      onProgress?.(i + 1, times.length);
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}
