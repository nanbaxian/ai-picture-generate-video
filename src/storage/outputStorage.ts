import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config.js";

export class OutputStorage {
  private readonly s3Client: S3Client | null;

  constructor(private readonly config: AppConfig) {
    this.s3Client = config.r2
      ? new S3Client({
          region: "auto",
          endpoint: config.r2.endpoint,
          credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey
          },
          forcePathStyle: true
        })
      : null;
  }

  async init(): Promise<void> {
    await mkdir(this.config.outputDir, { recursive: true });
  }

  localOutputPath(taskId: string): string {
    return path.join(this.config.outputDir, this.fileName(taskId));
  }

  async publish(taskId: string, outputPath: string): Promise<string> {
    const fileName = this.fileName(taskId);
    if (!this.config.r2 || !this.s3Client) {
      return `${this.config.publicBaseUrl}/videos/${encodeURIComponent(fileName)}`;
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.config.r2.bucket,
        Key: fileName,
        Body: createReadStream(outputPath),
        ContentType: "video/mp4"
      })
    );

    return `${this.config.r2.publicBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(fileName)}`;
  }

  private fileName(taskId: string): string {
    return `${taskId}.mp4`;
  }
}
