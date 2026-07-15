# Scene-Based Video Engine PRD V3

## Vision

Build a scene-based rendering API that transforms structured JSON into short-form marketing videos.

The engine is content agnostic. It should support real estate, school promotion, storytelling, AI marketing, digital human content, and future AI-generated content without changing the rendering architecture.

---

## Current Scope

This repository implements the Linux/VPS rendering service only.

It does not implement the Cloudflare Worker, D1 database, or queue layer. Those can call this VPS API as an external video provider.

Implemented:

* `POST /api/video/create`
* `GET /api/video/status/:taskId`
* `GET /health`
* Edge-TTS or OpenVoice V2 narration
* Remotion rendering
* ffmpeg MP4 post-processing
* Local task storage
* Optional R2 upload
* Local MP4 serving with HTTP byte range support

---

## Core Principle

Everything is a scene.

A scene contains:

* Assets
* Narration
* Subtitle
* Timing
* Animation

Video = collection of scenes.

---

## Architecture

Current implemented service:

```
Caller
  -> VPS API
  -> JSON validation
  -> local task store
  -> selected TTS provider
  -> ffprobe duration measurement
  -> timeline generation
  -> Remotion render
  -> ffmpeg MP4 remux
  -> R2 upload or local file serving
  -> video URL
```

Expected integration with the existing app:

```
Cloudflare Worker
  -> POST /api/video/create on VPS
  -> store provider task id
  -> poll GET /api/video/status/:taskId
  -> store completed video URL
```

---

## API Contract

### Create

`POST /api/video/create`

Returns `202` by default:

```json
{
  "taskId": "video_abc123",
  "status": "pending",
  "progress": 0
}
```

For local testing, `POST /api/video/create?wait=true` waits up to 120 seconds and can return the completed result directly.

### Status

`GET /api/video/status/:taskId`

Completed:

```json
{
  "taskId": "video_abc123",
  "status": "completed",
  "progress": 100,
  "duration": 10.752,
  "videoUrl": "https://cdn.example.com/output/video_abc123.mp4"
}
```

Failed:

```json
{
  "taskId": "video_abc123",
  "status": "failed",
  "progress": 100,
  "errorMessage": "Generated narration audio is silent or unreadable"
}
```

---

## Content Model

```
Video
  -> Scenes
  -> Assets
```

---

## Video Schema

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
  "ttsprovider": "edgetts",
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

The service also accepts `scene.voiceText` for compatibility and normalizes it to `scene.narration`.

---

## Scene Schema

```json
{
  "id": "scene-1",
  "title": "Front Exterior",
  "subtitle": "Luxury Condo In North York",
  "narration": "Welcome to this luxury condo located in the heart of North York.",
  "assets": []
}
```

---

## Asset Schema

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

Future asset types:

* `avatar`
* `3d`

---

## Timeline Engine

The narration audio duration is the source of truth.

Example:

* Narration: `6 seconds`
* Assets: `3 images`
* Image 1: `0-2 sec`
* Image 2: `2-4 sec`
* Image 3: `4-6 sec`
* Subtitle: `0-6 sec`
* Voice: `0-6 sec`

Current implementation splits each scene duration evenly across that scene's assets.

---

## Subtitle Engine

Current implementation:

* Source: `scene.subtitle`
* Render position: bottom safe area
* Style: large centered caption over semi-transparent dark background

Future:

* Generate word-level timestamps from narration
* Current-word highlight
* Animated subtitle emphasis

---

## Voice Engine

The API supports two providers:

* `edgetts` (default): Microsoft Edge-TTS preset voices.
* `openvoice`: MeloTTS plus OpenVoice V2 voice cloning.

OpenVoice reference audio resolution order:

1. `voice.referenceAudioPath`
2. `voice.referenceAudioUrl`
3. `OPENVOICE_REFERENCE_AUDIO_PATH`

The URL can be an R2 public URL or a short-lived presigned URL. The VPS
downloads it to the task workspace before generating each scene.

Edge-TTS implementation:

* Provider: Edge-TTS
* Output: one MP3 per scene
* Duration measurement: `ffprobe`
* Silent narration detection: enabled in production mode

Supported voice names are those accepted by Edge-TTS. Common examples:

* `en-CA-ClaraNeural`
* `en-CA-LiamNeural`
* `zh-CN-XiaoxiaoNeural`

Development mode:

* `VIDEO_ALLOW_SILENT_TTS=1` allows silent fallback audio if Edge-TTS fails.
* Do not enable this in production.

---

## Asset Animation Engine

Image animations:

* `zoom-in`
* `zoom-out`
* `pan-left`
* `pan-right`
* `fade`

Video assets:

* Native playback
* Muted by default so narration remains primary

If animation is missing or `auto`, the engine selects a deterministic animation from the supported list.

---

## Branding Engine

Optional:

* Logo top right
* Watermark bottom right

Future:

* Agent name
* Call to action
* QR code

---

## Music Engine

Current implementation:

* Optional background music URL
* Looped by Remotion
* Static volume from `music.volume`

Future:

* Automatic trim rules
* Volume ducking under narration

---

## Rendering Engine

Current implementation:

* Default resolution: `1080x1920`
* Default FPS: `30`
* Renderer: Remotion
* Post-processing: ffmpeg
* Output format: MP4
* Video codec: H.264
* Audio codec: AAC
* Audio sample rate: 48kHz
* Audio channels: stereo
* MP4 faststart: enabled
* Final audio validation: enabled

---

## Storage

Local task status:

`WORK_DIR/tasks/<taskId>.json`

Local generated assets:

`WORK_DIR/<taskId>/scene-<n>.mp3`

Local output:

`OUTPUT_DIR/<taskId>.mp4`

If R2 environment variables are configured, the final MP4 is uploaded to R2.

If R2 is not configured, the service returns:

`<PUBLIC_BASE_URL>/videos/<taskId>.mp4`

---

## Failure Handling

Current implementation marks the task as `failed` and stores `errorMessage`.

Failures are detected for:

* Invalid request schema
* Edge-TTS failure
* Silent narration audio in production
* Media duration read failure
* Remotion render failure
* ffmpeg post-processing failure
* Silent final MP4 audio
* R2 upload failure

Future:

* Retry policy per stage
* Cleanup old task work directories
* Persistent database-backed task store

---

## Template System

Template = visual style.

Current examples:

* `real-estate`
* `luxury`
* `modern`
* `corporate`

The JSON remains unchanged. Only visual rendering changes.

---

## Future Roadmap

V4:

* Multi-language
* Auto translation
* Auto voice localization

V5:

* Digital human
* Lip sync
* Avatar scene

V6:

* AI agent video generation
* Generate JSON
* Render video
* Publish to social media
