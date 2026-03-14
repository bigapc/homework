import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const port = 3123;
const baseUrl = `http://127.0.0.1:${port}`;

let serverProcess;
let serverLogs = "";

async function waitForServerReady(maxAttempts = 50, intervalMs = 200) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is not ready yet.
    }
    await delay(intervalMs);
  }

  throw new Error(`Server did not become ready in time. Logs:\n${serverLogs}`);
}

async function requestJson(pathname, init) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : {};
  return { response, body };
}

before(async () => {
  serverProcess = spawn("node", ["server/app.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: "",
      DIRECT_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });

  serverProcess.stderr.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });

  await waitForServerReady();
});

after(() => {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  serverProcess.kill("SIGTERM");
});

test("health endpoint returns ok and valid storage mode", async () => {
  const { response, body } = await requestJson("/api/health");

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.ok(["prisma", "fallback"].includes(body.storage));
});

test("SOS endpoint rejects missing location", async () => {
  const { response, body } = await requestJson("/api/sos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: "", notes: "x" }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "Location is required");
});

test("SOS endpoint creates and returns alert", async () => {
  const { response, body } = await requestJson("/api/sos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: "Test Location", notes: "Smoke test" }),
  });

  assert.equal(response.status, 201);
  assert.equal(body.message, "SOS alert saved.");
  assert.equal(body.alert.location, "Test Location");
});

test("Check-in endpoint validates duration", async () => {
  const { response, body } = await requestJson("/api/checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contactName: "Alex", duration: 0, notes: "bad" }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "Contact name and duration are required");
});

test("Onboarding endpoint enforces unique email", async () => {
  const email = `smoke-${Date.now()}@example.com`;
  const payload = {
    fullName: "Test Courier",
    email,
    phone: "555-000-0000",
    availability: "weekends",
    maxRadius: 10,
  };

  const first = await requestJson("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(first.response.status, 201);
  assert.equal(first.body.message, "Driver onboarded successfully.");

  const second = await requestJson("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(second.response.status, 409);
  assert.equal(second.body.error, "Email already exists");
});
