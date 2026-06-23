import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CreateVideoRequest } from "../domain/videoSchema.js";

export type VideoTaskStatus = "pending" | "processing" | "rendering" | "completed" | "failed";

export type VideoTask = {
  taskId: string;
  status: VideoTaskStatus;
  request: CreateVideoRequest;
  progress: number;
  duration?: number | undefined;
  videoUrl?: string | undefined;
  errorMessage?: string | undefined;
  createdAt: string;
  updatedAt: string;
};

export class TaskStore {
  constructor(private readonly rootDir: string) {}

  async init(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  async create(taskId: string, request: CreateVideoRequest): Promise<VideoTask> {
    const now = new Date().toISOString();
    const task: VideoTask = {
      taskId,
      status: "pending",
      request,
      progress: 0,
      createdAt: now,
      updatedAt: now
    };
    await this.save(task);
    return task;
  }

  async get(taskId: string): Promise<VideoTask | null> {
    try {
      const raw = await readFile(this.filePath(taskId), "utf8");
      return JSON.parse(raw) as VideoTask;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async update(taskId: string, patch: Partial<Omit<VideoTask, "taskId" | "request" | "createdAt">>): Promise<VideoTask> {
    const current = await this.get(taskId);
    if (!current) {
      throw new Error(`Task not found: ${taskId}`);
    }
    const next: VideoTask = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    await this.save(next);
    return next;
  }

  private async save(task: VideoTask): Promise<void> {
    await writeFile(this.filePath(task.taskId), `${JSON.stringify(task, null, 2)}\n`, "utf8");
  }

  private filePath(taskId: string): string {
    return path.join(this.rootDir, `${taskId}.json`);
  }
}

