import { spawn } from "node:child_process";

export function runCommand(command: string, args: string[]): Promise<void> {
  return runProcess(command, args).then(() => undefined);
}

export function runCapture(command: string, args: string[]): Promise<string> {
  return runProcess(command, args).then((result) => result.stdout);
}

export function runCaptureWithStderr(command: string, args: string[]): Promise<string> {
  return runProcess(command, args).then((result) => `${result.stdout}\n${result.stderr}`);
}

function runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      reject(formatSpawnError(command, error));
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(formatSpawnError(command, error));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited with ${code}: ${stderr.slice(0, 600)}`));
      }
    });
  });
}

function formatSpawnError(command: string, error: unknown): Error {
  if (!isNodeSpawnError(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  if (error.code === "EACCES") {
    return new Error(
      `Cannot execute ${command}: permission denied. Make sure EDGE_TTS_BIN points to an executable installed for the same Linux user that runs this service. If you installed with pipx as root, either run 'chmod +x ${command}' and allow access to parent directories, or reinstall as the service user with 'python3 -m pip install --user edge-tts' and set EDGE_TTS_BIN to that user's edge-tts path.`
    );
  }

  if (error.code === "ENOENT") {
    return new Error(
      `Cannot find ${command}. Install the dependency or set the matching *_BIN environment variable to its absolute executable path.`
    );
  }

  return error;
}

function isNodeSpawnError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
