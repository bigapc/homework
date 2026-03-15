import 'dotenv/config';
import path from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import express from "express";
import { PrismaClient } from "@prisma/client";

let prisma;
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const ADMIN_API_KEY = trimText(process.env.ADMIN_API_KEY);

const fallbackStore = {
  mode: "fallback",
  nextAlertId: 1,
  nextCheckInId: 1,
  nextDriverId: 1,
  sosAlerts: [],
  checkIns: [],
  onboardings: [],
};

let storagePromise;

function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}

function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value) {
  const normalized = trimText(value);
  return normalized || null;
}

function normalizeOptionalInt(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  return /^[0-9+().\-\s]{7,20}$/.test(value);
}

function exceedsLength(value, maxLength) {
  return typeof value === "string" && value.length > maxLength;
}

function safeTextCompare(left, right) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function requireAdminApiKey(req, res, next) {
  if (!ADMIN_API_KEY) {
    return res.status(503).json({ error: "Admin API key is not configured" });
  }

  const providedKey = trimText(req.get("x-admin-api-key"));

  if (!providedKey || !safeTextCompare(providedKey, ADMIN_API_KEY)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

function createFallbackApi() {
  return {
    mode: fallbackStore.mode,
    async createSosAlert({ location, notes }) {
      const alert = {
        id: fallbackStore.nextAlertId++,
        location,
        notes,
        createdAt: new Date().toISOString(),
      };

      fallbackStore.sosAlerts.unshift(alert);
      return alert;
    },
    async listSosAlerts() {
      return [...fallbackStore.sosAlerts];
    },
    async createCheckIn({ contactName, duration, notes }) {
      const checkIn = {
        id: fallbackStore.nextCheckInId++,
        contactName,
        duration,
        notes,
        createdAt: new Date().toISOString(),
      };

      fallbackStore.checkIns.unshift(checkIn);
      return checkIn;
    },
    async listCheckIns() {
      return [...fallbackStore.checkIns];
    },
    async createOnboarding({ fullName, email, phone, availability, maxRadius }) {
      if (fallbackStore.onboardings.some((entry) => entry.email.toLowerCase() === email.toLowerCase())) {
        const error = new Error("Email already exists");
        error.code = "P2002";
        throw error;
      }

      const driver = {
        id: fallbackStore.nextDriverId++,
        fullName,
        email,
        phone,
        availability,
        maxRadius,
        backgroundCheckPassed: false,
        createdAt: new Date().toISOString(),
      };

      fallbackStore.onboardings.unshift(driver);
      return driver;
    },
  };
}

async function createStorage() {
  try {
    const prismaClient = getPrismaClient();

    const hasRequiredModels =
      typeof prismaClient.sOSAlert?.create === "function" &&
      typeof prismaClient.sOSAlert?.findMany === "function" &&
      typeof prismaClient.checkIn?.create === "function" &&
      typeof prismaClient.checkIn?.findMany === "function" &&
      typeof prismaClient.courierOnboarding?.create === "function";

    if (!hasRequiredModels) {
      console.warn("SafeConnect storage fallback enabled: generated Prisma client does not match the current API models.");
      return createFallbackApi();
    }

    await prismaClient.$connect();

    return {
      mode: "prisma",
      async createSosAlert({ location, notes }) {
        return prismaClient.sOSAlert.create({
          data: { location, notes },
        });
      },
      async listSosAlerts() {
        return prismaClient.sOSAlert.findMany({
          orderBy: { createdAt: "desc" },
        });
      },
      async createCheckIn({ contactName, duration, notes }) {
        return prismaClient.checkIn.create({
          data: { contactName, duration, notes },
        });
      },
      async listCheckIns() {
        return prismaClient.checkIn.findMany({
          orderBy: { createdAt: "desc" },
        });
      },
      async createOnboarding({ fullName, email, phone, availability, maxRadius }) {
        return prismaClient.courierOnboarding.create({
          data: { fullName, email, phone, availability, maxRadius },
        });
      },
    };
  } catch (error) {
    console.warn(`SafeConnect storage fallback enabled: ${error.message}`);
    return createFallbackApi();
  }
}

async function getStorage() {
  if (!storagePromise) {
    storagePromise = createStorage();
  }

  return storagePromise;
}

app.use(express.json({ limit: "100kb" }));
app.use(express.static(rootDir));

app.get("/api/health", async (_req, res) => {
  try {
    const storage = await getStorage();
    res.json({ status: "ok", storage: storage.mode, adminAuthEnabled: Boolean(ADMIN_API_KEY) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read health status" });
  }
});

/* ===============================
   SOS Alert Route
================================ */
app.post("/api/sos", async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: "JSON object body is required" });
    }

    const storage = await getStorage();
    const location = trimText(req.body.location);
    const notes = normalizeOptionalText(req.body.notes);

    if (!location) {
      return res.status(400).json({ error: "Location is required" });
    }

    if (exceedsLength(location, 120) || exceedsLength(notes, 1000)) {
      return res.status(400).json({ error: "One or more fields exceed allowed length" });
    }

    const alert = await storage.createSosAlert({ location, notes });

    res.status(201).json({ message: "SOS alert saved.", alert });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save SOS alert" });
  }
});

/* ===============================
   Check-In Route
================================ */
app.post("/api/checkin", async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: "JSON object body is required" });
    }

    const storage = await getStorage();
    const contactName = trimText(req.body.contactName);
    const duration = Number(req.body.duration);
    const notes = normalizeOptionalText(req.body.notes);

    if (!contactName || !Number.isInteger(duration) || duration <= 0 || duration > 1440) {
      return res.status(400).json({ error: "Contact name and duration are required" });
    }

    if (exceedsLength(contactName, 120) || exceedsLength(notes, 1000)) {
      return res.status(400).json({ error: "One or more fields exceed allowed length" });
    }

    const checkIn = await storage.createCheckIn({
      contactName,
      duration,
      notes,
    });

    res.status(201).json({ message: "Check-In saved.", checkIn });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save Check-In" });
  }
});

/* ===============================
   GET Routes (Admin View)
================================ */
app.get("/api/sos", requireAdminApiKey, async (req, res) => {
  try {
    const storage = await getStorage();
    const alerts = await storage.listSosAlerts();
    res.json(alerts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch SOS alerts" });
  }
});

app.get("/api/checkin", requireAdminApiKey, async (req, res) => {
  try {
    const storage = await getStorage();
    const checkIns = await storage.listCheckIns();
    res.json(checkIns);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch check-ins" });
  }
});

// ---------- Driver Onboarding ----------
app.post("/api/onboarding", async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: "JSON object body is required" });
    }

    const storage = await getStorage();
    const fullName = trimText(req.body.fullName);
    const email = trimText(req.body.email);
    const phone = trimText(req.body.phone);
    const availability = normalizeOptionalText(req.body.availability);
    const maxRadius = normalizeOptionalInt(req.body.maxRadius);

    if (!fullName || !email || !phone) {
      return res.status(400).json({ error: "Full name, email, and phone are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "A valid email is required" });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: "A valid phone number is required" });
    }

    if (maxRadius !== null && (maxRadius <= 0 || maxRadius > 500)) {
      return res.status(400).json({ error: "maxRadius must be an integer between 1 and 500" });
    }

    if (
      exceedsLength(fullName, 120) ||
      exceedsLength(email, 254) ||
      exceedsLength(phone, 32) ||
      exceedsLength(availability, 500)
    ) {
      return res.status(400).json({ error: "One or more fields exceed allowed length" });
    }

    if (req.body.maxRadius !== undefined && req.body.maxRadius !== null && req.body.maxRadius !== "" && maxRadius === null) {
      return res.status(400).json({ error: "maxRadius must be an integer between 1 and 500" });
    }

    const newDriver = await storage.createOnboarding({
      fullName,
      email,
      phone,
      availability,
      maxRadius,
    });

    res.status(201).json({ message: "Driver onboarded successfully.", driver: newDriver });
  } catch (err) {
    console.error(err);
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Failed to onboard driver" });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request payload too large" });
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
});


/* ===============================
   Graceful Shutdown
================================ */
process.on("SIGINT", async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
const shouldStartServer = process.env.VERCEL !== "1";

if (shouldStartServer) {
  app.listen(PORT, () => {
    console.log(`🚀 SafeConnect running at http://localhost:${PORT}`);
  });
}

export default app;
