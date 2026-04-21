import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
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
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Robust Firebase Initialization
let db: any;
function initFirebase() {
  if (db) return db;
  try {
    // Try multiple path patterns for Vercel environments
    const paths = [
      join(__dirname, "..", "firebase-applet-config.json"),
      join(process.cwd(), "firebase-applet-config.json"),
      join(__dirname, "firebase-applet-config.json")
    ];
    
    let configPath = "";
    for (const p of paths) {
      if (existsSync(p)) {
        configPath = p;
        break;
      }
    }

    if (!configPath) throw new Error("Firebase config file not found in any expected location");

    const firebaseConfig = JSON.parse(readFileSync(configPath, "utf8"));
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    return db;
  } catch (e) {
    console.error("Firebase Initialization Failure:", e);
    return null;
  }
}

const mockCurrent = () => ({
  temp: parseFloat((20 + Math.random() * 15).toFixed(1)),
  humidity: Math.floor(40 + Math.random() * 40),
  rain: Math.random() > 0.8 ? 1 : 0,
  timestamp: new Date().toISOString()
});

// ✅ Receive data from ESP8266
const handlePostData = async (req: any, res: any) => {
  const database = initFirebase();
  if (!database) return res.status(500).json({ error: "Database not initialized" });

  try {
    const { temp, humidity, rain, ip } = req.body;
    
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

    const docRef = await addDoc(collection(database, "telemetry"), newData);
    res.json({ status: "success", id: docRef.id });
  } catch (err) {
    console.error("Firestore write error:", err);
    res.status(500).json({ error: "Internal database error" });
  }
};

// API Fetcher
const handleGetData = async (req: any, res: any) => {
  const database = initFirebase();
  if (!database) {
    return res.json({ current: mockCurrent(), history: [], status: { system: 'db_offline' }, source: 'mock' });
  }

  try {
    const q = query(collection(database, "telemetry"), orderBy("timestamp", "desc"), limit(50));
    const querySnapshot = await getDocs(q);
    
    const history = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        timestamp: (data.timestamp as Timestamp)?.toDate()?.toISOString() || new Date().toISOString()
      };
    }).reverse();

    // If history is empty, generate 10 synthetic data points to prevent a blank chart
    const finalHistory = history.length > 0 ? history : Array.from({ length: 15 }).map((_, i) => ({
      ...mockCurrent(),
      temp: 22 + Math.sin(i / 2) * 5,
      timestamp: new Date(Date.now() - (15 - i) * 60000).toISOString()
    }));

    const current = history.length > 0 ? history[history.length - 1] : finalHistory[finalHistory.length - 1];

    res.json({ 
      current,
      history: finalHistory,
      status: {
        system: history.length > 0 ? 'online' : 'offline',
        lastUpdate: current.timestamp
      },
      source: history.length > 0 ? 'firestore' : 'synthetic'
    });
  } catch (err) {
    console.error("Firestore read error:", err);
    res.json({ current: mockCurrent(), history: [], status: { system: 'error' }, source: 'mock' });
  }
};

// Flexible route matching for Vercel
app.all(["/api/data", "/data"], async (req, res) => {
  if (req.method === 'POST') return await handlePostData(req, res);
  if (req.method === 'GET') return await handleGetData(req, res);
  res.status(405).json({ error: "Method not allowed" });
});

app.get("/api/health", (req, res) => res.json({ status: "ok", env: process.env.NODE_ENV, vercel: !!process.env.VERCEL }));

export default app;
