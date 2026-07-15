import { mkdir } from "node:fs/promises";
import path from "node:path";
import { runCommand } from "./command.js";

export type TtsInput = {
  edgeTtsBin: string;
  provider?: "edge-tts" | "openvoice-v2";
  openVoicePython?: string;
  openVoiceScript?: string;
  openVoiceDir?: string;
  referenceAudioPath?: string;
  language?: string;
  allowSilentTts: boolean;
  voiceName: string;
  speed: number;
  text: string;
  outputPath: string;
};

export async function synthesizeVoice(input: TtsInput): Promise<void> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  try {
    if (input.provider === "openvoice-v2") {
      if (!input.referenceAudioPath) throw new Error("OpenVoice V2 requires voice.referenceAudioPath");
      await runCommand(input.openVoicePython ?? "python3", [
        input.openVoiceScript ?? "./scripts/openvoice_tts.py", "--openvoice-dir", input.openVoiceDir ?? "./OpenVoice",
        "--text", input.text, "--reference", input.referenceAudioPath, "--language", input.language ?? "EN",
        "--speed", String(input.speed), "--output", input.outputPath
      ]);
      return;
    }
    await runCommand(input.edgeTtsBin, [
      "--voice",
      input.voiceName,
      "--rate",
      edgeRate(input.speed),
      "--text",
      input.text,
      "--write-media",
      input.outputPath
    ]);
  } catch (error) {
    if (!input.allowSilentTts) {
      throw error;
    }
    await createSilentAudio(input.outputPath, Math.max(3, estimateSpeechSeconds(input.text, input.speed)));
  }
}

function edgeRate(speed: number): string {
  const percent = Math.round((speed - 1) * 100);
  return `${percent >= 0 ? "+" : ""}${percent}%`;
}

function estimateSpeechSeconds(text: string, speed: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const base = Math.max(2, words * 0.42 + 1.5);
  return Math.round((base / Math.max(speed, 0.25)) * 10) / 10;
}

async function createSilentAudio(outputPath: string, duration: number): Promise<void> {
  await runCommand("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-t",
    String(duration),
    "-q:a",
    "9",
    "-acodec",
    "libmp3lame",
    "-y",
    outputPath
  ]);
}


