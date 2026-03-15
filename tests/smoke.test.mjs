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

test("SOS endpoint rejects non-object body", async () => {
  const { response, body } = await requestJson("/api/sos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(["not-an-object"]),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "JSON object body is required");
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

test("SOS endpoint accepts location at max allowed length", async () => {
  const location = "L".repeat(120);
  const { response, body } = await requestJson("/api/sos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location, notes: "Boundary test" }),
  });

  assert.equal(response.status, 201);
  assert.equal(body.alert.location, location);
});

test("SOS endpoint rejects location over max length", async () => {
  const { response, body } = await requestJson("/api/sos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: "L".repeat(121), notes: "too long" }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "One or more fields exceed allowed length");
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

test("Check-in endpoint rejects non-integer duration", async () => {
  const { response, body } = await requestJson("/api/checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contactName: "Alex", duration: 15.5, notes: "bad" }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "Contact name and duration are required");
});

test("Check-in endpoint rejects contactName over max length", async () => {
  const { response, body } = await requestJson("/api/checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contactName: "A".repeat(121), duration: 15, notes: "too long" }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "One or more fields exceed allowed length");
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

test("Onboarding endpoint rejects invalid email", async () => {
  const { response, body } = await requestJson("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Courier Test",
      email: "not-an-email",
      phone: "555-000-0000",
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "A valid email is required");
});

test("Onboarding endpoint rejects invalid phone", async () => {
  const { response, body } = await requestJson("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Courier Test",
      email: `phone-${Date.now()}@example.com`,
      phone: "abc",
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "A valid phone number is required");
});

test("Onboarding endpoint rejects non-integer maxRadius", async () => {
  const { response, body } = await requestJson("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Courier Test",
      email: `radius-${Date.now()}@example.com`,
      phone: "555-000-0000",
      maxRadius: "abc",
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "maxRadius must be an integer between 1 and 500");
});

test("Onboarding endpoint rejects availability over max length", async () => {
  const { response, body } = await requestJson("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Courier Test",
      email: `availability-${Date.now()}@example.com`,
      phone: "555-000-0000",
      availability: "W".repeat(501),
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, "One or more fields exceed allowed length");
});

test("Server returns 400 for invalid JSON body", async () => {
  const response = await fetch(`${baseUrl}/api/sos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "Invalid JSON body");
});
