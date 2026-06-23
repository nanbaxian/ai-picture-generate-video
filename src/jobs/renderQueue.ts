import type { AppConfig } from "../config.js";
import { renderVideoTask } from "../render/renderJob.js";
import type { OutputStorage } from "../storage/outputStorage.js";
import type { TaskStore } from "./taskStore.js";

export class RenderQueue {
  private readonly queue: string[] = [];
  private active = false;

  constructor(
    private readonly config: AppConfig,
    private readonly store: TaskStore,
    private readonly outputStorage: OutputStorage
  ) {}

  enqueue(taskId: string): void {
    this.queue.push(taskId);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.active) {
      return;
    }
    this.active = true;
    try {
      while (this.queue.length > 0) {
        const taskId = this.queue.shift();
        if (!taskId) continue;
        const task = await this.store.get(taskId);
        if (!task || task.status !== "pending") {
          continue;
        }
        try {
          await renderVideoTask({
            task,
            config: this.config,
            store: this.store,
            outputStorage: this.outputStorage
          });
        } catch (error) {
          await this.store.update(taskId, {
            status: "failed",
            progress: 100,
            errorMessage: error instanceof Error ? error.message : "Unknown render failure"
          });
        }
      }
    } finally {
      this.active = false;
    }
  }
}

