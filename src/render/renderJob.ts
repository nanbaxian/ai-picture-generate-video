import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "../config.js";
import { buildRenderPlan, type RenderPlan } from "../domain/timeline.js";
import { normalizeVideoRequest } from "../domain/videoSchema.js";
import type { TaskStore, VideoTask } from "../jobs/taskStore.js";
import { OutputStorage } from "../storage/outputStorage.js";
import { remuxMp4ForPlayback } from "./ffmpegPostprocess.js";
import { assertAudioIsNotSilent, getMediaDurationSeconds } from "./mediaProbe.js";
import { synthesizeVoice } from "./tts.js";

const compositionEntry = path.join(path.dirname(fileURLToPath(import.meta.url)), "remotionRoot.tsx");
let bundledServeUrl: string | null = null;

export async function renderVideoTask(input: {
  task: VideoTask;
  config: AppConfig;
  store: TaskStore;
  outputStorage: OutputStorage;
}): Promise<void> {
  const { task, config, store, outputStorage } = input;
  const taskWorkDir = path.join(config.workDir, task.taskId);
  await mkdir(taskWorkDir, { recursive: true });
  await store.update(task.taskId, { status: "processing", progress: 5 });

  const request = normalizeVideoRequest(task.request);
  const referenceAudioPath = await resolveReferenceAudio({ request, taskWorkDir, defaultPath: config.openVoiceReferenceAudioPath });
  const sceneVoiceUrls: string[] = [];
  const sceneDurations: number[] = [];

  for (let index = 0; index < request.scenes.length; index += 1) {
    const scene = request.scenes[index];
    if (!scene) continue;
    const voicePath = path.join(taskWorkDir, `scene-${index + 1}.mp3`);
    await synthesizeVoice({
      edgeTtsBin: config.edgeTtsBin,
      provider: request.voice.provider,
      openVoicePython: config.openVoicePython,
      openVoiceScript: config.openVoiceScript,
      openVoiceDir: config.openVoiceDir,
      referenceAudioPath,
      language: request.voice.language,
      allowSilentTts: config.allowSilentTts,
      voiceName: request.voice.voiceName,
      speed: request.voice.speed,
      text: scene.narration,
      outputPath: voicePath
    });
    if (!config.allowSilentTts) {
      await assertAudioIsNotSilent(voicePath);
    }
    sceneVoiceUrls.push(`${config.publicBaseUrl}/work-assets/${encodeURIComponent(task.taskId)}/scene-${index + 1}.mp3`);
    sceneDurations.push(await getMediaDurationSeconds(voicePath));
    await store.update(task.taskId, { progress: 10 + Math.round(((index + 1) / request.scenes.length) * 35) });
  }

  const renderPlan = buildRenderPlan({ request, sceneVoiceUrls, sceneDurations });
  await store.update(task.taskId, { status: "rendering", progress: 50 });
  const videoUrl = await renderWithRemotion({
    taskId: task.taskId,
    renderPlan,
    outputPath: outputStorage.localOutputPath(task.taskId),
    outputStorage
  });
  await store.update(task.taskId, {
    status: "completed",
    progress: 100,
    duration: renderPlan.duration,
    videoUrl
  });
}

async function resolveReferenceAudio(input: {
  request: ReturnType<typeof normalizeVideoRequest>;
  taskWorkDir: string;
  defaultPath: string;
}): Promise<string | undefined> {
  if (input.request.voice.provider !== "openvoice-v2") {
    return undefined;
  }
  if (input.request.voice.referenceAudioPath) {
    return input.request.voice.referenceAudioPath;
  }
  const referenceAudioUrl = input.request.voice.referenceAudioUrl;
  if (!referenceAudioUrl) return input.defaultPath;
  const response = await fetch(referenceAudioUrl);
  if (!response.ok) {
    throw new Error(`Unable to download OpenVoice reference audio: HTTP ${response.status}`);
  }
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 25 * 1024 * 1024) {
    throw new Error("OpenVoice reference audio must be 25 MB or smaller");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 25 * 1024 * 1024) {
    throw new Error("OpenVoice reference audio must be 25 MB or smaller");
  }
  const outputPath = path.join(input.taskWorkDir, "openvoice-reference-audio");
  await writeFile(outputPath, bytes);
  return outputPath;
}

async function renderWithRemotion(input: {
  taskId: string;
  renderPlan: RenderPlan;
  outputPath: string;
  outputStorage: OutputStorage;
}): Promise<string> {
  const serveUrl = await getServeUrl();
  const composition = await selectComposition({
    serveUrl,
    id: "SceneMarketingVideo",
    inputProps: input.renderPlan
  });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: input.outputPath,
    inputProps: input.renderPlan,
    chromiumOptions: {
      gl: "angle"
    }
  });
  await remuxMp4ForPlayback(input.outputPath);
  await assertAudioIsNotSilent(input.outputPath);
  return await input.outputStorage.publish(input.taskId, input.outputPath);
}

async function getServeUrl(): Promise<string> {
  if (bundledServeUrl) {
    return bundledServeUrl;
  }
  bundledServeUrl = await bundle({
    entryPoint: compositionEntry,
    webpackOverride: (config) => config
  });
  return bundledServeUrl;
}
