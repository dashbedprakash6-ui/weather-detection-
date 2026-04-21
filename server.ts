import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  serverTimestamp,
  Timestamp 
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const app = express();
const PORT = 3000;

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const mockCurrent = () => ({
  temp: parseFloat((20 + Math.random() * 15).toFixed(1)),
  humidity: Math.floor(40 + Math.random() * 40),
  rain: Math.random() > 0.8 ? 1 : 0,
  timestamp: new Date().toISOString()
});

// ✅ Receive data from ESP8266
const handlePostData = async (req: any, res: any) => {
  try {
    const { temp, humidity, rain, ip } = req.body;
    
    // Validate basic types
    if (typeof temp !== 'number' || typeof humidity !== 'number') {
      return res.status(400).json({ error: "Invalid sensor data format" });
    }

    const newData = {
      temp,
      humidity,
      rain: rain ? 1 : 0,
      ip: ip || req.headers['x-forwarded-for'] || req.ip,
      timestamp: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "telemetry"), newData);
    console.log("Telemetry stored in Firestore:", docRef.id);
    
    res.json({ status: "success", id: docRef.id });
  } catch (err) {
    console.error("Firestore write error:", err);
    res.status(500).json({ error: "Internal database error" });
  }
};

app.post("/data", handlePostData);
app.post("/api/data", handlePostData);

// API Proxy and Fetcher
app.get("/api/data", async (req, res) => {
  try {
    const q = query(collection(db, "telemetry"), orderBy("timestamp", "desc"), limit(50));
    const querySnapshot = await getDocs(q);
    
    const history = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        timestamp: (data.timestamp as Timestamp)?.toDate().toISOString() || new Date().toISOString()
      };
    }).reverse();

    const current = history.length > 0 ? history[history.length - 1] : mockCurrent();

    res.json({ 
      current,
      history: history.length > 0 ? history : [],
      status: {
        system: history.length > 0 ? 'online' : 'offline',
        lastUpdate: current.timestamp
      },
      source: history.length > 0 ? 'firestore' : 'mock'
    });
  } catch (err) {
    console.error("Firestore read error:", err);
    // Fallback to mock if DB fails
    res.json({ current: mockCurrent(), history: [], status: { system: 'error' }, source: 'mock' });
  }
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
