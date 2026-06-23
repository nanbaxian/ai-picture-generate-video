# Video Engine JSON Schema V1

This document describes the Linux/VPS rendering API implemented in this repository.

The Cloudflare Worker or any other caller can submit a scene-based JSON payload to the VPS. The VPS renders the video with Edge-TTS, Remotion, and ffmpeg, then returns a task status and final video URL.

---

## Create Video

`POST /api/video/create`

Optional query:

`?wait=true` waits up to 120 seconds for completion. Without it, the endpoint returns immediately with a pending task.

Auth:

If `API_TOKEN` is configured, send:

```http
Authorization: Bearer <API_TOKEN>
```

Example request:

```json
{
  "template": "real-estate",
  "metadata": {
    "title": "Luxury Condo",
    "language": "en"
  },
  "video": {
    "width": 1080,
    "height": 1920,
    "fps": 30
  },
  "voice": {
    "provider": "edge-tts",
    "voiceName": "en-CA-ClaraNeural",
    "speed": 1.0
  },
  "music": {
    "url": "https://cdn.example.com/music/soft.mp3",
    "volume": 0.15
  },
  "branding": {
    "logoUrl": "https://cdn.example.com/logo.png",
    "watermark": "Brand"
  },
  "scenes": [
    {
      "id": "scene-1",
      "subtitle": "Luxury Condo In North York",
      "narration": "Welcome to this luxury condo located in the heart of North York.",
      "assets": [
        {
          "type": "image",
          "url": "https://cdn.example.com/cover.jpg",
          "animation": "zoom-in"
        },
        {
          "type": "image",
          "url": "https://cdn.example.com/livingroom.jpg",
          "animation": "pan-left"
        }
      ]
    }
  ]
}
```

Compatibility:

`scene.voiceText` is also accepted and is normalized to `scene.narration`.

---

## Status

`GET /api/video/status/:taskId`

Example:

```json
{
  "taskId": "video_abc123",
  "status": "completed",
  "progress": 100,
  "duration": 10.752,
  "videoUrl": "https://cdn.example.com/output/video_abc123.mp4"
}
```

Statuses:

* `pending`
* `processing`
* `rendering`
* `completed`
* `failed`

Failed response includes `errorMessage`.

---

## Schema

### Video

```json
{
  "template": "real-estate",
  "metadata": {
    "title": "Luxury Condo",
    "language": "en"
  },
  "video": {
    "width": 1080,
    "height": 1920,
    "fps": 30
  },
  "voice": {
    "provider": "edge-tts",
    "voiceName": "en-CA-ClaraNeural",
    "speed": 1.0
  },
  "music": {
    "url": "https://cdn.example.com/music.mp3",
    "volume": 0.15
  },
  "branding": {
    "logoUrl": "https://cdn.example.com/logo.png",
    "watermark": "Brand"
  },
  "scenes": []
}
```

Required:

* `template`
* `scenes`

Defaults:

* `video.width`: `1080`
* `video.height`: `1920`
* `video.fps`: `30`
* `voice.provider`: `edge-tts`
* `voice.voiceName`: `en-CA-ClaraNeural`
* `voice.speed`: `1.0`

### Scene

```json
{
  "id": "scene-1",
  "title": "Front Exterior",
  "subtitle": "Luxury Condo In North York",
  "narration": "Welcome to this luxury condo located in the heart of North York.",
  "assets": []
}
```

Each scene requires:

* `id`
* `subtitle`
* `narration` or `voiceText`
* at least one asset

### Asset

```json
{
  "type": "image",
  "url": "https://cdn.example.com/cover.jpg",
  "animation": "zoom-in"
}
```

Supported asset types:

* `image`
* `video`

Supported image animations:

* `zoom-in`
* `zoom-out`
* `pan-left`
* `pan-right`
* `fade`
* `auto`

Video assets use native playback with animation `none`.

---

## Timing Rules

The narration audio duration is the source of truth for each scene.

Example:

* Narration duration: `6s`
* Assets: `3 images`
* Image 1: `0s-2s`
* Image 2: `2s-4s`
* Image 3: `4s-6s`
* Subtitle: `0s-6s`
* Voice: `0s-6s`

---

## Output Video

Current output:

* Format: MP4
* Video codec: H.264
* Audio codec: AAC
* Audio sample rate: 48kHz
* Audio channels: stereo
* `faststart`: enabled
* Local output path: `storage/output/<taskId>.mp4`

If R2 is configured, the completed video is uploaded to R2 and `videoUrl` uses `R2_PUBLIC_BASE_URL`.

If R2 is not configured, the VPS serves the file from:

`/videos/<taskId>.mp4`

The local video endpoint supports HTTP byte ranges.

---

## Render Flow

1. Receive `POST /api/video/create`.
2. Validate JSON with Zod.
3. Create local task JSON under `WORK_DIR/tasks`.
4. Generate one Edge-TTS MP3 per scene.
5. Verify narration audio is not silent.
6. Measure narration duration with `ffprobe`.
7. Build scene timeline from narration duration and asset count.
8. Render with Remotion.
9. Remux with ffmpeg to H.264 + AAC + faststart MP4.
10. Verify final MP4 audio is not silent.
11. Publish to R2 or local `/videos`.
12. Update task status.
