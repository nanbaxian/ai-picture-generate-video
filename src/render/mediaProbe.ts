import { spawn } from "node:child_process";

export async function getMediaDurationSeconds(filePath: string): Promise<number> {
  const output = await runCapture("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath
  ]);
  const duration = Number(output.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Unable to read media duration for ${filePath}`);
  }
  return Math.round(duration * 1000) / 1000;
}

export async function assertAudioIsNotSilent(filePath: string): Promise<void> {
  const output = await runCaptureWithStderr("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    filePath,
    "-af",
    "volumedetect",
    "-f",
    "null",
    "-"
  ]);
  const match = output.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/);
  const meanVolume = match ? Number(match[1]) : Number.NEGATIVE_INFINITY;
  if (!Number.isFinite(meanVolume) || meanVolume < -70) {
    throw new Error(`Generated narration audio is silent or unreadable: ${filePath}`);
  }
}

function runCapture(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`${command} exited with ${code}: ${stderr.slice(0, 600)}`));
      }
    });
  });
}

function runCaptureWithStderr(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const output = `${stdout}\n${stderr}`;
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`${command} exited with ${code}: ${output.slice(0, 600)}`));
      }
    });
  });
}
