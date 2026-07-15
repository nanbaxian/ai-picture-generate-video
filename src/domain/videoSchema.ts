import { z } from "zod";

export const assetAnimationSchema = z.enum(["zoom-in", "zoom-out", "pan-left", "pan-right", "fade", "none", "auto"]);

export const videoAssetSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.string().url(),
  animation: assetAnimationSchema.optional()
});

export const sceneSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  subtitle: z.string().min(1),
  voiceText: z.string().optional(),
  narration: z.string().optional(),
  assets: z.array(videoAssetSchema).min(1)
}).refine((scene) => Boolean((scene.voiceText ?? scene.narration ?? "").trim()), {
  message: "Scene requires voiceText or narration"
});

export const createVideoRequestSchema = z.object({
  template: z.string().min(1).default("real-estate"),
  ttsprovider: z.enum(["edgetts", "openvoice"]).default("edgetts"),
  metadata: z.object({
    title: z.string().optional(),
    language: z.string().optional()
  }).optional(),
  video: z.object({
    width: z.number().int().positive().default(1080),
    height: z.number().int().positive().default(1920),
    fps: z.number().int().positive().default(30)
  }).default({ width: 1080, height: 1920, fps: 30 }),
  voice: z.object({
    provider: z.enum(["edge-tts", "openvoice-v2"]).default("edge-tts"),
    voiceName: z.string().min(1).default("en-CA-ClaraNeural"),
    speed: z.number().positive().default(1),
    referenceAudioPath: z.string().min(1).optional(),
    referenceAudioUrl: z.string().url().optional(),
    language: z.enum(["EN", "ZH", "ES", "FR", "JA", "KO"]).default("EN")
  }).default({ provider: "edge-tts", voiceName: "en-CA-ClaraNeural", speed: 1 }),
  music: z.object({
    url: z.string().url(),
    volume: z.number().min(0).max(1).default(0.15)
  }).optional(),
  branding: z.object({
    logoUrl: z.string().url().optional(),
    watermark: z.string().optional(),
    agentName: z.string().optional(),
    callToAction: z.string().optional()
  }).optional(),
  scenes: z.array(sceneSchema).min(1)
});

export type CreateVideoRequest = z.infer<typeof createVideoRequestSchema>;
export type VideoScene = z.infer<typeof sceneSchema>;
export type VideoAsset = z.infer<typeof videoAssetSchema>;
export type AssetAnimation = z.infer<typeof assetAnimationSchema>;

export type NormalizedScene = VideoScene & {
  narration: string;
};

export type NormalizedVideoRequest = Omit<CreateVideoRequest, "scenes"> & {
  scenes: NormalizedScene[];
};

export function normalizeVideoRequest(input: CreateVideoRequest): NormalizedVideoRequest {
  return {
    ...input,
    voice: {
      ...input.voice,
      provider: input.ttsprovider === "openvoice" ? "openvoice-v2" : "edge-tts"
    },
    scenes: input.scenes.map((scene) => ({
      ...scene,
      narration: (scene.narration ?? scene.voiceText ?? "").replace(/\s+/g, " ").trim()
    }))
  };
}

