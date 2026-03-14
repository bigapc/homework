import 'dotenv/config';
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { PrismaClient } from "@prisma/client";

let prisma;
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

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

app.use(express.json());
app.use(express.static(rootDir));

app.get("/api/health", async (_req, res) => {
  const storage = await getStorage();
  res.json({ status: "ok", storage: storage.mode });
});

/* ===============================
   SOS Alert Route
================================ */
app.post("/api/sos", async (req, res) => {
  try {
    const storage = await getStorage();
    const location = trimText(req.body.location);
    const notes = normalizeOptionalText(req.body.notes);

    if (!location) {
      return res.status(400).json({ error: "Location is required" });
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
    const storage = await getStorage();
    const contactName = trimText(req.body.contactName);
    const duration = Number(req.body.duration);
    const notes = normalizeOptionalText(req.body.notes);

    if (!contactName || !Number.isFinite(duration) || duration <= 0) {
      return res.status(400).json({ error: "Contact name and duration are required" });
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
app.get("/api/sos", async (req, res) => {
  const storage = await getStorage();
  const alerts = await storage.listSosAlerts();
  res.json(alerts);
});

app.get("/api/checkin", async (req, res) => {
  const storage = await getStorage();
  const checkIns = await storage.listCheckIns();
  res.json(checkIns);
});

// ---------- Driver Onboarding ----------
app.post("/api/onboarding", async (req, res) => {
  try {
    const storage = await getStorage();
    const fullName = trimText(req.body.fullName);
    const email = trimText(req.body.email);
    const phone = trimText(req.body.phone);
    const availability = normalizeOptionalText(req.body.availability);
    const maxRadius = normalizeOptionalInt(req.body.maxRadius);

    if (!fullName || !email || !phone) {
      return res.status(400).json({ error: "Full name, email, and phone are required" });
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
