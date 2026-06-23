import Fastify from "fastify";
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { loadConfig } from "./config.js";
import { createVideoRequestSchema } from "./domain/videoSchema.js";
import { createByteRangeStream } from "./render/ffmpegPostprocess.js";
import { RenderQueue } from "./jobs/renderQueue.js";
import { TaskStore } from "./jobs/taskStore.js";
import { OutputStorage } from "./storage/outputStorage.js";

const config = loadConfig();
const app = Fastify({ logger: true, bodyLimit: 20 * 1024 * 1024 });
const store = new TaskStore(path.join(config.workDir, "tasks"));
const outputStorage = new OutputStorage(config);
const queue = new RenderQueue(config, store, outputStorage);

await mkdir(config.workDir, { recursive: true });
await store.init();
await outputStorage.init();

app.addHook("preHandler", async (request, reply) => {
  if (!config.apiToken || request.url === "/health" || request.url.startsWith("/videos/") || request.url.startsWith("/work-assets/")) {
    return;
  }
  const header = request.headers.authorization ?? "";
  if (header !== `Bearer ${config.apiToken}`) {
    await reply.code(401).send({ error: "Unauthorized" });
  }
});

app.get("/health", async () => ({
  ok: true,
  service: "ai-picture-generate-video"
}));

app.post("/api/video/create", async (request, reply) => {
  const parsed = createVideoRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({
      error: "Invalid video request",
      issues: parsed.error.issues
    });
  }
  const taskId = `video_${nanoid(12)}`;
  const task = await store.create(taskId, parsed.data);
  queue.enqueue(task.taskId);

  if ((request.query as { wait?: string } | undefined)?.wait === "true") {
    const completed = await waitForTask(task.taskId, 120_000);
    return reply.code(completed.status === "failed" ? 500 : 200).send(toResponse(completed));
  }

  return reply.code(202).send(toResponse(task));
});

app.get("/api/video/status/:taskId", async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const task = await store.get(taskId);
  if (!task) {
    return reply.code(404).send({ error: "Task not found" });
  }
  return toResponse(task);
});

app.get("/videos/:fileName", async (request, reply) => {
  const { fileName } = request.params as { fileName: string };
  if (!/^[a-zA-Z0-9_-]+\.mp4$/.test(fileName)) {
    return reply.code(400).send({ error: "Invalid file name" });
  }
  const filePath = path.join(config.outputDir, fileName);
  const file = await stat(filePath);
  const range = request.headers.range;
  reply.header("Accept-Ranges", "bytes");
  reply.header("Cache-Control", "public, max-age=31536000, immutable");
  if (range) {
    const part = createByteRangeStream({ filePath, fileSize: file.size, rangeHeader: range });
    if (!part) {
      return reply
        .code(416)
        .header("Content-Range", `bytes */${file.size}`)
        .send();
    }
    return reply
      .code(206)
      .type("video/mp4")
      .header("Content-Length", String(part.end - part.start + 1))
      .header("Content-Range", `bytes ${part.start}-${part.end}/${file.size}`)
      .send(part.stream);
  }
  return reply
    .type("video/mp4")
    .header("Content-Length", String(file.size))
    .send(createReadStream(filePath));
});

app.get("/work-assets/:taskId/:fileName", async (request, reply) => {
  const { taskId, fileName } = request.params as { taskId: string; fileName: string };
  if (!/^video_[a-zA-Z0-9_-]+$/.test(taskId) || !/^scene-\d+\.mp3$/.test(fileName)) {
    return reply.code(400).send({ error: "Invalid work asset" });
  }
  return reply.type("audio/mpeg").send(createReadStream(path.join(config.workDir, taskId, fileName)));
});

await app.listen({ host: config.host, port: config.port });

async function waitForTask(taskId: string, timeoutMs: number) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const task = await store.get(taskId);
    if (!task) {
      throw new Error(`Task disappeared: ${taskId}`);
    }
    if (task.status === "completed" || task.status === "failed") {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const task = await store.get(taskId);
  if (!task) {
    throw new Error(`Task disappeared: ${taskId}`);
  }
  return task;
}

function toResponse(task: Awaited<ReturnType<TaskStore["get"]>> extends infer T ? NonNullable<T> : never) {
  return {
    taskId: task.taskId,
    status: task.status,
    progress: task.progress,
    duration: task.duration,
    videoUrl: task.videoUrl,
    errorMessage: task.errorMessage
  };
}
