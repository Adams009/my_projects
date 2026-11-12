import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";
import { uploadReportImages } from "../src/middleware/report-image.middleware.js";

const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Jx8AAAAASUVORK5CYII=",
  "base64",
);

async function startUploadServer(t) {
  const app = express();
  app.post("/upload", uploadReportImages, (request, response) => {
    response.json({ count: request.files.length });
  });

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  return `http://127.0.0.1:${server.address().port}/upload`;
}

test("report image middleware accepts valid image content and allows no images", async (t) => {
  const url = await startUploadServer(t);
  const emptyResponse = await fetch(url, {
    method: "POST",
    body: new FormData(),
  });

  assert.equal(emptyResponse.status, 200);
  assert.deepEqual(await emptyResponse.json(), { count: 0 });

  const formData = new FormData();
  formData.append("images", new Blob([pngBytes], { type: "image/png" }), "issue.png");
  const imageResponse = await fetch(url, {
    method: "POST",
    body: formData,
  });

  assert.equal(imageResponse.status, 200);
  assert.deepEqual(await imageResponse.json(), { count: 1 });
});

test("report image middleware rejects a spoofed image MIME type", async (t) => {
  const url = await startUploadServer(t);
  const formData = new FormData();
  formData.append(
    "images",
    new Blob(["not an image"], { type: "image/png" }),
    "spoofed.png",
  );
  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /valid JPEG, PNG, or WebP/);
});
