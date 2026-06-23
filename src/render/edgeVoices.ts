import { spawn } from "node:child_process";

export type EdgeVoice = {
  voiceId: string;
  name: string;
  language: string;
  locale: string;
  gender: string;
  ageGroup: string;
  traits: string[];
  previewAudioUrl: null;
  provider: "edge-tts";
};

export async function listEdgeVoices(edgeTtsBin: string): Promise<EdgeVoice[]> {
  const output = await runCommand(edgeTtsBin, ["--list-voices"]);
  return parseEdgeVoiceList(output);
}

export function parseEdgeVoiceList(output: string): EdgeVoice[] {
  return output
    .split("\n")
    .slice(2)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [voiceId = "", gender = "", categories = "", personalities = ""] = line.split(/\s{2,}/);
      const locale = voiceId.split("-").slice(0, 2).join("-");
      const displayName = voiceId.replace(/^[a-z]{2}-[A-Z]{2,3}-/i, "").replace(/Neural$/i, "");
      const traits = [...new Set([...splitTraitText(categories), ...splitTraitText(personalities)])].slice(0, 4);
      return {
        voiceId,
        name: displayName || voiceId,
        language: languageLabelFromLocale(locale),
        locale,
        gender,
        ageGroup: inferAgeGroup(voiceId),
        traits,
        previewAudioUrl: null,
        provider: "edge-tts" as const
      };
    })
    .filter((voice) => voice.voiceId.includes("-"));
}

function splitTraitText(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && item !== "General");
}

function inferAgeGroup(voiceId: string): string {
  if (/girl|boy|child|kid|teen/i.test(voiceId)) return "Youth";
  if (/senior|elder/i.test(voiceId)) return "Mature";
  return "Adult";
}

function languageLabelFromLocale(locale: string): string {
  const labels: Record<string, string> = {
    en: "English",
    zh: "Chinese",
    fr: "French",
    es: "Spanish"
  };
  const language = locale.split("-")[0]?.toLowerCase() || "";
  return labels[language] ?? locale;
}

function runCommand(command: string, args: string[]): Promise<string> {
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
