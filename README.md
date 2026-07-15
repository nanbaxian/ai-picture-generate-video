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
python3 -m pip install --user edge-tts
npm run dev
```

Submit the included example:

```bash
npm run sample
```

For local development without Edge-TTS, set `VIDEO_ALLOW_SILENT_TTS=1`. Production should use Edge-TTS.

### OpenVoice V2 voice cloning

Use `provider: "openvoice-v2"` with a clean reference recording. The adapter
uses MeloTTS for speech and OpenVoice V2 to transfer the reference voice color.
Install the official OpenVoice V2 checkpoints and dependencies in a Python
environment, then configure `OPENVOICE_PYTHON`, `OPENVOICE_SCRIPT`, and
`OPENVOICE_DIR` if the defaults do not apply.

Example:

```json
{
  "voice": {
    "provider": "openvoice-v2",
    "referenceAudioPath": "/srv/voices/my-voice.wav",
    "language": "ZH",
    "speed": 1
  }
}
```

Only clone voices when you have permission to use the reference recording.

## Linux Dependencies

Install Chrome dependencies required by Remotion, CJK fonts for Chinese/Japanese/Korean subtitles, and Edge-TTS:

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg python3-pip fonts-noto-cjk fonts-wqy-zenhei
python3 -m pip install --user edge-tts
```
Set `EDGE_TTS_BIN` to the executable visible to the service user. Avoid pointing a PM2/systemd service at `/root/.local/bin/edge-tts` unless the service also runs as root and the file is executable.

```bash
set -a
source .env
set +a
pm2 restart ai-picture-generate-video --update-env
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
