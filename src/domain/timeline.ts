import type { AssetAnimation, NormalizedVideoRequest, VideoAsset } from "./videoSchema.js";

export type TimelineAsset = VideoAsset & {
  start: number;
  duration: number;
  animation: AssetAnimation;
};

export type TimelineScene = {
  id: string;
  title?: string | undefined;
  subtitle: string;
  narration: string;
  start: number;
  duration: number;
  voiceAudioUrl: string;
  assets: TimelineAsset[];
};

export type RenderPlan = {
  template: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  scenes: TimelineScene[];
  music?: { url: string; volume: number } | undefined;
  branding?: NormalizedVideoRequest["branding"] | undefined;
};

const DEFAULT_ANIMATIONS: AssetAnimation[] = ["zoom-in", "pan-left", "zoom-out", "pan-right", "fade"];

export function buildRenderPlan(input: {
  request: NormalizedVideoRequest;
  sceneVoiceUrls: string[];
  sceneDurations: number[];
}): RenderPlan {
  let cursor = 0;
  const scenes = input.request.scenes.map((scene, sceneIndex) => {
    const duration = round(input.sceneDurations[sceneIndex] ?? 3);
    const assetDuration = duration / scene.assets.length;
    let assetCursor = 0;
    const assets = scene.assets.map((asset, assetIndex) => {
      const isLast = assetIndex === scene.assets.length - 1;
      const segmentDuration = isLast ? duration - assetCursor : assetDuration;
      const timelineAsset: TimelineAsset = {
        ...asset,
        start: round(assetCursor),
        duration: round(segmentDuration),
        animation: normalizeAnimation(asset.animation, sceneIndex, assetIndex, asset.type)
      };
      assetCursor += segmentDuration;
      return timelineAsset;
    });
    const timelineScene: TimelineScene = {
      id: scene.id,
      title: scene.title,
      subtitle: scene.subtitle,
      narration: scene.narration,
      start: round(cursor),
      duration,
      voiceAudioUrl: input.sceneVoiceUrls[sceneIndex] ?? "",
      assets
    };
    cursor += duration;
    return timelineScene;
  });
  return {
    template: input.request.template,
    width: input.request.video.width,
    height: input.request.video.height,
    fps: input.request.video.fps,
    duration: round(cursor),
    scenes,
    music: input.request.music,
    branding: input.request.branding
  };
}

function normalizeAnimation(
  animation: AssetAnimation | undefined,
  sceneIndex: number,
  assetIndex: number,
  assetType: VideoAsset["type"]
): AssetAnimation {
  if (assetType === "video") {
    return "none";
  }
  if (animation && animation !== "auto" && animation !== "none") {
    return animation;
  }
  return DEFAULT_ANIMATIONS[(sceneIndex + assetIndex) % DEFAULT_ANIMATIONS.length] ?? "zoom-in";
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

