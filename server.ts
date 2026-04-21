import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Memory storage for latest Weather data
let currentTelemetry: any = null;
let history: any[] = [];

const mockData = () => {
  const temp = parseFloat((20 + Math.random() * 15).toFixed(1));
  const humidity = Math.floor(40 + Math.random() * 40);
  const rain = Math.random() > 0.8 ? 1 : 0;
  
  return {
    temp,
    humidity,
    rain,
    timestamp: new Date().toISOString()
  };
};

// Seed history
history = Array.from({ length: 20 }, (_, i) => ({
  temp: 20 + Math.random() * 15,
  humidity: 40 + Math.random() * 40,
  rain: Math.random() > 0.9 ? 1 : 0,
  timestamp: new Date(Date.now() - (20 - i) * 60000).toISOString()
}));

// ✅ Receive data from ESP8266 (Compatibility /data and /api/data)
const handlePostData = (req: any, res: any) => {
  const newData = {
    ...req.body,
    ip: req.body.ip || req.headers['x-forwarded-for'] || req.ip, // Store the reported IP or the request source IP
    timestamp: new Date().toISOString()
  };
  currentTelemetry = newData;
  history.push(newData);
  if (history.length > 50) history.shift();
  
  console.log("Weather telemetry updated:", currentTelemetry);
  res.json({ status: "success", received: true });
};

app.post("/data", handlePostData);
app.post("/api/data", handlePostData);

// API Proxy and Fetcher
app.get("/api/data", async (req, res) => {
  const current = currentTelemetry || mockData();
  res.json({ 
    current,
    history,
    status: {
      system: currentTelemetry ? 'online' : 'offline',
      lastUpdate: current.timestamp
    },
    source: currentTelemetry ? 'esp' : 'mock'
  });
});

// Vite/Static serving wrapper
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// Start listener only if not in serverless environment
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  setupVite().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

// Export the app for Vercel
export default app;
