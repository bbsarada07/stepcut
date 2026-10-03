/** [ymin, xmin, ymax, xmax], each 0..1000 relative to the video frame. */
export type Box = [number, number, number, number];

export type Step = {
  id: string;
  startSec: number;
  endSec: number;
  captionEn: string;
  sensitive: boolean;
  sensitiveLabel: string;
  boxes: Box[];
  keep: boolean;
  hide: boolean;
};

export type Plan = { title: string; language: string; steps: Step[] };

/** A step as /api/plan returns it: no client flags yet, plus the caption in the plan's language. */
export type PlannedStep = Omit<Step, "keep" | "hide"> & { caption: string };

export type PlanResponse = { plan: { title: string; language: string; steps: PlannedStep[] }; modelUsed: string };

export type FrameSample = { tSec: number; static: boolean; jpegBase64: string };

export type PlanRequest = {
  request: string;
  languageName: string | null;
  durationSec: number;
  frames: FrameSample[];
};
