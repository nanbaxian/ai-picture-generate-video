import { readFile } from "node:fs/promises";

const endpoint = process.env.VIDEO_API_URL ?? "http://localhost:8080/api/video/create?wait=true";
const token = process.env.API_TOKEN;
const body = await readFile("samples/create-video.json", "utf8");

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  },
  body
});

const payload = await response.json();
console.log(JSON.stringify(payload, null, 2));

if (!response.ok) {
  process.exitCode = 1;
}
