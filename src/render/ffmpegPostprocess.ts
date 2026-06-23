import { createReadStream } from "node:fs";
import { rename, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";

export async function remuxMp4ForPlayback(inputPath: string): Promise<void> {
  const tempPath = `${inputPath}.tmp.mp4`;
  try {
    await runCommand("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      tempPath
    ]);
    await rename(tempPath, inputPath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

export function createByteRangeStream(input: {
  filePath: string;
  fileSize: number;
  rangeHeader: string;
}): { start: number; end: number; stream: ReturnType<typeof createReadStream> } | null {
  const match = input.rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) {
    return null;
  }
  const requestedStart = match[1] ? Number(match[1]) : 0;
  const requestedEnd = match[2] ? Number(match[2]) : input.fileSize - 1;
  if (!Number.isInteger(requestedStart) || !Number.isInteger(requestedEnd)) {
    return null;
  }
  const start = Math.max(0, requestedStart);
  const end = Math.min(input.fileSize - 1, requestedEnd);
  if (start > end) {
    return null;
  }
  return {
    start,
    end,
    stream: createReadStream(input.filePath, { start, end })
  };
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code}: ${stderr.slice(0, 600)}`));
      }
    });
  });
}

