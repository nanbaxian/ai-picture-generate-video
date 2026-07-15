export type AppConfig = {
  host: string;
  port: number;
  apiToken?: string | undefined;
  workDir: string;
  outputDir: string;
  publicBaseUrl: string;
  edgeTtsBin: string;
  openVoicePython: string;
  openVoiceScript: string;
  openVoiceDir: string;
  openVoiceReferenceAudioPath: string;
  allowSilentTts: boolean;
  r2?: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicBaseUrl: string;
  } | undefined;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const r2 = env.R2_ENDPOINT && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET && env.R2_PUBLIC_BASE_URL
    ? {
        endpoint: env.R2_ENDPOINT,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_BUCKET,
        publicBaseUrl: env.R2_PUBLIC_BASE_URL
      }
    : undefined;
  return {
    host: env.HOST ?? "0.0.0.0",
    port: Number(env.PORT ?? 8080),
    apiToken: env.API_TOKEN || undefined,
    workDir: env.WORK_DIR ?? "./storage/work",
    outputDir: env.OUTPUT_DIR ?? "./storage/output",
    publicBaseUrl: (env.PUBLIC_BASE_URL ?? `http://localhost:${env.PORT ?? 8080}`).replace(/\/$/, ""),
    edgeTtsBin: env.EDGE_TTS_BIN ?? "edge-tts",
    openVoicePython: env.OPENVOICE_PYTHON ?? "python3",
    openVoiceScript: env.OPENVOICE_SCRIPT ?? "./scripts/openvoice_tts.py",
    openVoiceDir: env.OPENVOICE_DIR ?? "./OpenVoice",
    openVoiceReferenceAudioPath: env.OPENVOICE_REFERENCE_AUDIO_PATH ?? "/www/wwwroot/default/voices/demo_man.wav",
    allowSilentTts: env.VIDEO_ALLOW_SILENT_TTS === "1",
    r2
  };
}

