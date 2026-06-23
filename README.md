# AI Picture Generate Video

Linux/VPS video rendering API for the scene-based JSON format in `prd.md` and `Video Engine JSON Schema.md`.

## API

- `POST /api/video/create` creates a render task.
- `GET /api/video/status/:taskId` returns task status and `videoUrl` when done.
- `GET /health` returns service health.

The request body supports both document variants: `scene.voiceText` and `scene.narration`.

## Local Run

```bash
npm install
cp .env.example .env
pipx install edge-tts
npm run dev
```

Submit the included example:

```bash
npm run sample
```

For local development without Edge-TTS, set `VIDEO_ALLOW_SILENT_TTS=1`. Production should use Edge-TTS.

## Linux Dependencies

Install Chrome dependencies required by Remotion and install Edge-TTS:

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg python3-pip pipx
pipx ensurepath
pipx install edge-tts
```

## Worker Integration Shape

Cloudflare Worker should call:

```http
POST https://your-vps.example.com/api/video/create
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

The response is:

```json
{
  "taskId": "video_abc",
  "status": "rendering"
}
```

Then poll:

```http
GET https://your-vps.example.com/api/video/status/video_abc
Authorization: Bearer <API_TOKEN>
```

Completed response:

```json
{
  "taskId": "video_abc",
  "status": "completed",
  "duration": 28.5,
  "videoUrl": "https://cdn.example.com/output/video_abc.mp4"
}
```
