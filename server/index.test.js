import { after, test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
const { app } = await import("./index.js");
const server = app.listen(0);
const baseUrl = await new Promise((resolve) => {
  server.once("listening", () => {
    const address = server.address();
    resolve(`http://127.0.0.1:${address.port}`);
  });
});

after(() => new Promise((resolve) => server.close(resolve)));

test("health endpoint reports server and configuration status", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.online, true);
  assert.equal(typeof result.geminiConfigured, "boolean");
  assert.equal(typeof result.firebaseAdminConfigured, "boolean");
});

test("the server serves the app without exposing backend files", async () => {
  const homepage = await fetch(`${baseUrl}/index.html`);
  const homepageText = await homepage.text();
  const backendFile = await fetch(`${baseUrl}/server/index.js`);

  assert.equal(homepage.status, 200);
  assert.match(homepageText, /Turn your notes into understanding/);
  assert.equal(backendFile.status, 404);
});

test("AI endpoints require a Firebase bearer token", async () => {
  const response = await fetch(`${baseUrl}/api/ai/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "A private study note" })
  });
  const result = await response.json();

  assert.equal(response.status, 401);
  assert.match(result.error, /Firebase/);
});
