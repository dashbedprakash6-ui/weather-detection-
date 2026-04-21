import { useEffect, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CloudRain, 
  Thermometer, 
  Droplets, 
  Cloud,
  Layers, 
  RefreshCcw, 
  AlertCircle,
  Sparkles,
  Bot,
  Wind,
  ShieldCheck,
  ShieldAlert,
  ShieldX
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";
import { DashboardData, WeatherAnalysis } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // AI States
  const [analysis, setAnalysis] = useState<WeatherAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentLang, setCurrentLang] = useState<'en' | 'hi' | 'odia' | 'bengali' | 'tamil'>('en');
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [viewMode, setViewMode] = useState<'advanced' | 'simple'>('advanced');

  const fetchData = async () => {
    try {
      const response = await fetch('/api/data');
      const result = await response.json();
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError("Failed to connect to the weather station backend.");
    } finally {
      setLoading(false);
    }
  };

  const speak = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Find a better voice if possible, but default is okay
    window.speechSynthesis.speak(utterance);
  };

  const handleAnalyze = async () => {
    if (!data) return;
    setAnalyzing(true);
    
    try {
      // Create a brief overview of historical trends for the AI
      const trendData = data.history.slice(-10).map(h => `[${new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]: T:${h.temp}C, H:${h.humidity}%, R:${h.rain}`).join("\n");

      const prompt = `You are the Nexus Weather Intelligence Core. 
      
      CURRENT SENSOR METRICS:
      Temperature: ${data.current.temp} °C
      Humidity: ${data.current.humidity} %
      Rain: ${data.current.rain === 1 ? "Rain Detected" : "No Rain"}
      
      HISTORICAL DATA TRENDS (Last 10 cycles):
      ${trendData}
      
      TASKS:
      1. Analyze the current conditions.
      2. Analyze the TREND. Is it getting hotter? Is rain becoming more likely?
      3. Predict the weather for the NEXT 60 MINUTES (Forecasting).
      4. Suggest an "Energy Mode": How should the user optimize their home/device power given the weather? (energyTip)
      5. Describe condition, identify risks, and suggest solutions.
      6. Assign alert level: SAFE, WARNING, or DANGER.
      7. Create a SIMPLE READABLE message and translations.
      8. Generate a SHORT voice alert sentence.
      
      Return valid JSON according to schema.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              condition: { type: Type.STRING },
              problems: { type: Type.ARRAY, items: { type: Type.STRING } },
              solutions: { type: Type.ARRAY, items: { type: Type.STRING } },
              alert: { type: Type.STRING, enum: ["SAFE", "WARNING", "DANGER"] },
              forecast: { 
                type: Type.STRING, 
                description: "AI-powered prediction for the next 60 minutes based on trend analysis." 
              },
              energyTip: {
                type: Type.STRING,
                description: "A digital twin tip for home/device energy optimization based on current weather."
              },
              simpleMessage: { type: Type.STRING },
              translations: {
                type: Type.OBJECT,
                properties: {
                  hindi: { type: Type.STRING },
                  odia: { type: Type.STRING },
                  bengali: { type: Type.STRING },
                  tamil: { type: Type.STRING }
                },
                required: ["hindi", "odia", "bengali", "tamil"]
              },
              voiceAlert: { type: Type.STRING }
            },
            required: ["condition", "problems", "solutions", "alert", "forecast", "simpleMessage", "translations", "voiceAlert"]
          }
        }
      });

      const result = JSON.parse(response.text);
      setAnalysis(result);
      if (speechEnabled) speak(result.voiceAlert);
    } catch (err) {
      console.error("AI Analysis failed:", err);
      // Fallback
      setAnalysis({
        condition: "Analysis unavailable.",
        problems: ["AI Service Error"],
        solutions: ["Manual inspection"],
        alert: "WARNING",
        forecast: "Forecasting engine offline. Trend analysis unavailable.",
        energyTip: "Switch to standard battery-saver mode.",
        simpleMessage: "Technical error in analysis systems. Please check sensors manually.",
        translations: {
          hindi: "तकनीकी त्रुटि। कृपया जांचें।",
          odia: "ପ୍ରଯୁକ୍ତିଗତ ମୂଳକ ଭୁଲ | ଦୟาକରି ଯାଞ୍ଚ କରନ୍ତୁ |",
          bengali: "প্রযুক্তিগত ত্রুটি। দয়া করে পরীক্ষা করুন।",
          tamil: "தொழில்நுட்ப பிழை. தயவுசெய்து சரிபார்க்கவும்."
        },
        voiceAlert: "Caution. System error detecting weather data."
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Dynamic Background Calculation
  const getAtmosphereStyle = () => {
    if (!data) return {};
    const t = data.current.temp;
    const r = data.current.rain === 1;
    
    // Heat Glow: Orange/Red (242, 125, 38)
    // Cold Glow: Blue/Azure (14, 165, 233)
    // Rain Glow: Emerald/Teal (34, 197, 94)
    
    let color1 = "rgba(242, 125, 38, 0.12)"; // Default Hot
    if (t < 20) color1 = "rgba(14, 165, 233, 0.15)";
    else if (t < 30) color1 = "rgba(242, 125, 38, 0.08)";
    
    let color2 = r ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.06)";
    let color3 = "rgba(14, 165, 233, 0.06)";

    return {
      background: `
        radial-gradient(circle at 12% 18%, ${color1} 0%, transparent 45%),
        radial-gradient(circle at 88% 82%, ${color2} 0%, transparent 45%),
        radial-gradient(circle at 50% 50%, ${color3} 0%, transparent 60%)
      `
    };
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); 
    return () => clearInterval(interval);
  }, []);

  if (!data && loading) {
    return (
      <div className="min-h-screen bg-station-bg flex items-center justify-center font-mono">
        <div className="atmosphere opacity-100" />
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="animate-spin h-8 w-8 text-station-accent" />
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">Initializing Atmospheric Core...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans selection:bg-station-accent selection:text-white">
      <div className="atmosphere" style={getAtmosphereStyle()} />
      
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 glass-dark border-b border-white/5 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-8">
        <div className="flex items-center gap-4">
          <motion.div 
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.5 }}
            className="bg-station-accent/20 p-2.5 rounded-lg border border-station-accent/30"
          >
            <Wind className="text-station-accent h-6 w-6" />
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif italic text-2xl tracking-tight leading-none text-white">
                Nexus Weather Station
              </h1>
              <span className={`w-1.5 h-1.5 rounded-full ${data?.status.system === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            </div>
            <p className="font-mono text-[9px] uppercase opacity-40 mt-1.5 tracking-[0.15em]">Station ID: NX-01 // Grid Priority: High</p>
          </div>
        </div>

        <div className="flex items-center gap-6 font-mono text-[10px]">
          <div className="hidden xl:flex flex-col items-end opacity-40">
            <span className="uppercase tracking-widest text-[8px]">Spectral Sync</span>
            <span className="tracking-widest">{lastUpdated.toLocaleTimeString()}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const newState = !speechEnabled;
                setSpeechEnabled(newState);
                speak(newState ? "Vocal synthesis online." : "Silence engaged.");
              }}
              className={`p-2.5 rounded-lg border transition-all duration-300 ${speechEnabled ? 'bg-station-accent border-station-accent text-white neo-shadow' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'}`}
              title="Toggle Neural Voice"
            >
              <Bot className="h-4 w-4" />
            </button>
            <div className="h-4 w-px bg-white/10 mx-1" />
            <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
              <button 
                onClick={() => setViewMode('simple')}
                className={`px-3 py-1.5 rounded-md transition-all text-[9px] uppercase font-bold tracking-widest ${viewMode === 'simple' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}
              >
                Simple
              </button>
              <button 
                onClick={() => setViewMode('advanced')}
                className={`px-3 py-1.5 rounded-md transition-all text-[9px] uppercase font-bold tracking-widest ${viewMode === 'advanced' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}
              >
                Advanced
              </button>
            </div>
            <button 
              onClick={handleAnalyze}
              disabled={analyzing}
              className="bg-station-accent hover:bg-[#ff8c3a] text-white px-5 py-2.5 rounded-lg transition-all neo-shadow active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 group font-bold tracking-tight"
            >
              <Sparkles className={`h-3.5 w-3.5 ${analyzing ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'}`} />
              AI CORE
            </button>
          </div>
        </div>
      </nav>

      <main className="p-8 max-w-[1600px] mx-auto">
        {viewMode === 'simple' ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-8 py-10"
          >
            <div className="glass p-12 rounded-[2.5rem] text-center shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-station-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-30 mb-8">Atmospheric Observational Feed</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
                <div className="space-y-2">
                  <p className="font-serif italic text-station-accent opacity-60">Temp</p>
                  <p className="text-6xl font-mono tracking-tighter text-white tabular-nums">{data?.current.temp}°</p>
                </div>
                <div className="space-y-2">
                  <p className="font-serif italic text-station-accent opacity-60">Humidity</p>
                  <p className="text-6xl font-mono tracking-tighter text-white tabular-nums">{data?.current.humidity}%</p>
                </div>
                <div className="space-y-2">
                  <p className="font-serif italic text-station-accent opacity-60">Rain</p>
                  <p className="text-6xl font-mono tracking-tighter text-white">{data?.current.rain ? 'YES' : 'NO'}</p>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {analysis ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-12 rounded-[2.5rem] text-center neo-shadow border transition-all duration-1000 ${
                    analysis.alert === 'DANGER' ? 'bg-red-500/20 border-red-500/30 text-red-50' : 
                    analysis.alert === 'WARNING' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-50' : 
                    'bg-green-500/10 border-green-500/30 text-green-50'
                  }`}
                >
                  <div className="flex justify-center mb-8">
                    <div className={`p-6 rounded-full border ${
                      analysis.alert === 'DANGER' ? 'bg-red-500 border-red-400' : 
                      analysis.alert === 'WARNING' ? 'bg-yellow-500 border-yellow-400' : 
                      'bg-green-500 border-green-400'
                    }`}>
                      {analysis.alert === 'SAFE' ? <ShieldCheck className="h-12 w-12 text-white" /> :
                       analysis.alert === 'WARNING' ? <ShieldAlert className="h-12 w-12 text-black" /> :
                       <ShieldX className="h-12 w-12 text-white" />}
                    </div>
                  </div>
                  <h3 className="text-7xl font-mono mb-6 tracking-tighter uppercase">{analysis.alert}</h3>
                  <p className="font-serif italic text-3xl mb-4 leading-relaxed max-w-lg mx-auto">
                    {currentLang === 'en' ? analysis.simpleMessage : analysis.translations[currentLang as keyof typeof analysis.translations]}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-w-md mx-auto">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="font-mono text-[9px] uppercase tracking-widest opacity-40 mb-1 flex items-center justify-center gap-2">
                        <RefreshCcw className="h-2 w-2" /> Neural Forecast (60m)
                      </p>
                      <p className="text-[10px] font-medium italic opacity-80">{analysis.forecast}</p>
                    </div>
                    <div className="bg-station-accent/5 p-4 rounded-2xl border border-station-accent/10">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-station-accent/50 mb-1 flex items-center justify-center gap-2">
                        <Layers className="h-2 w-2" /> Energy Intelligence
                      </p>
                      <p className="text-[10px] font-medium italic text-station-accent/80">{analysis.energyTip}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-white/10 max-w-lg mx-auto">
                    <div className="text-left space-y-2">
                      <p className="font-mono text-[9px] uppercase tracking-widest opacity-40">Global Status</p>
                      <p className="text-sm font-medium opacity-80 leading-snug">{analysis.condition}</p>
                    </div>
                    <div className="text-left space-y-2">
                      <p className="font-mono text-[9px] uppercase tracking-widest opacity-40">Directives</p>
                      <p className="text-sm font-medium opacity-80 leading-snug">{analysis.solutions.join(" • ")}</p>
                    </div>
                  </div>

                  <div className="flex justify-center gap-4 mt-12">
                    <button 
                      onClick={() => speak(analysis.voiceAlert)}
                      className="bg-white/10 hover:bg-white/20 px-8 py-4 rounded-full transition-all flex items-center gap-3 active:scale-95 group border border-white/5"
                    >
                      <Wind className="h-5 w-5 text-station-accent group-hover:scale-110 transition-transform" />
                      <span className="font-mono text-xs uppercase font-bold tracking-widest">Replay Transmission</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="glass border-dashed p-24 rounded-[2.5rem] text-center space-y-6 opacity-60">
                  <Bot className="h-10 w-10 mx-auto text-station-accent animate-pulse" />
                  <div className="space-y-2">
                    <p className="font-mono text-xs uppercase tracking-[0.2em]">Neural Engine Idle</p>
                    <p className="text-[10px] opacity-40">Deploying assessment protocol will consume 0.2 units of energy</p>
                  </div>
                  <button 
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="bg-white text-black px-10 py-4 rounded-full font-bold tracking-[0.2em] uppercase text-[10px] hover:bg-station-accent hover:text-white transition-all neo-shadow active:scale-95 disabled:opacity-50"
                  >
                    {analyzing ? 'Processing...' : 'Engage Analysis'}
                  </button>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="space-y-8">
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/20 border border-red-500/30 text-red-200 p-4 rounded-xl flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest neo-shadow"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Connectivity Disrupt detected: {error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatBox 
                label="Thermals" 
                value={`${data?.current.temp}°C`} 
                icon={<Thermometer className="h-4 w-4" />} 
                trend={data && data.history.length > 1 ? data.current.temp - data.history[data.history.length-2].temp : 0}
              />
              <StatBox 
                label="Saturation" 
                value={`${data?.current.humidity}%`} 
                icon={<Droplets className="h-4 w-4" />} 
              />
              <StatBox 
                label="Hydration" 
                value={data?.current.rain === 1 ? 'ACTIVE' : 'STABLE'} 
                icon={<CloudRain className="h-4 w-4" />}
                isAlert={data?.current.rain === 1}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* AI assessment column */}
              <div className="lg:col-span-1">
                <AnimatePresence mode="wait">
                  {analysis ? (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`glass p-8 rounded-[2rem] h-full flex flex-col gap-8 neo-shadow border-t-2 ${
                        analysis.alert === 'DANGER' ? 'border-t-red-500/50' : 
                        analysis.alert === 'WARNING' ? 'border-t-yellow-500/50' : 
                        'border-t-green-500/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-widest text-station-accent opacity-60">Cognitive Analysis</p>
                          <h2 className={`text-4xl font-mono tracking-tighter uppercase mt-1 ${
                            analysis.alert === 'DANGER' ? 'text-red-400' : 
                            analysis.alert === 'WARNING' ? 'text-yellow-400' : 'text-green-400'
                          }`}>
                            {analysis.alert}
                          </h2>
                        </div>
                        <div className={`p-2.5 rounded-lg border ${
                          analysis.alert === 'DANGER' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
                          analysis.alert === 'WARNING' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' : 
                          'bg-green-500/10 border-green-500/20 text-green-400'
                        }`}>
                          {analysis.alert === 'SAFE' ? <ShieldCheck className="h-6 w-6" /> :
                           analysis.alert === 'WARNING' ? <ShieldAlert className="h-6 w-6" /> :
                           <ShieldX className="h-6 w-6" />}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-1.5 border-b border-white/5 pb-4">
                          {(['en', 'hi', 'odia', 'bengali', 'tamil'] as const).map((lang) => (
                            <button
                              key={lang}
                              onClick={() => setCurrentLang(lang)}
                              className={`px-2.5 py-1 rounded-md font-mono text-[9px] uppercase tracking-tighter border transition-all ${
                                currentLang === lang ? 'bg-station-accent border-station-accent text-white shadow-lg' : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10'
                              }`}
                            >
                              {lang}
                            </button>
                          ))}
                        </div>
                        <p className="font-serif italic text-xl leading-relaxed text-white/90">
                          "{currentLang === 'en' ? analysis.simpleMessage : analysis.translations[currentLang as keyof typeof analysis.translations]}"
                        </p>

                        <div className="space-y-3">
                          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <p className="font-mono text-[9px] uppercase tracking-widest opacity-40 mb-2 flex items-center gap-2">
                              <RefreshCcw className="h-2 w-2 text-sky-400" /> Neural Forecast (60m)
                            </p>
                            <p className="text-[11px] font-medium italic opacity-90 leading-relaxed text-white/70">
                              {analysis.forecast}
                            </p>
                          </div>
                          <div className="bg-station-accent/5 p-4 rounded-xl border border-station-accent/10">
                            <p className="font-mono text-[9px] uppercase tracking-widest text-station-accent/50 mb-2 flex items-center gap-2">
                              <Layers className="h-2 w-2" /> Energy Optimization
                            </p>
                            <p className="text-[11px] font-medium italic text-station-accent/80 leading-relaxed">
                              {analysis.energyTip}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6 flex-grow">
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-widest opacity-30 mb-3">Disruption Metrics</p>
                          <ul className="space-y-2.5">
                            {analysis.problems.map((p, i) => (
                              <li key={i} className="flex gap-3 items-start text-[11px] leading-snug text-white/60">
                                <span className="font-mono text-station-accent opacity-50">0{i+1}</span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-widest opacity-30 mb-3">Mitigation Logic</p>
                          <ul className="space-y-2">
                            {analysis.solutions.map((s, i) => (
                              <li key={i} className="flex gap-3 items-start text-[11px] leading-snug italic text-white/80">
                                <Bot className="h-3 w-3 text-station-accent mt-0.5" />
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <button 
                        onClick={() => speak(analysis.voiceAlert)}
                        className="glass-dark border-white/10 p-4 rounded-xl flex items-center gap-4 group hover:bg-white/5 transition-all text-left"
                      >
                        <div className="p-2 bg-station-accent/20 rounded-lg group-hover:scale-110 transition-transform">
                          <Wind className="h-4 w-4 text-station-accent" />
                        </div>
                        <div>
                          <p className="font-mono text-[8px] uppercase tracking-widest opacity-30">Vocal Feed</p>
                          <p className="text-[10px] font-medium leading-tight text-white/60">{analysis.voiceAlert}</p>
                        </div>
                      </button>
                    </motion.div>
                  ) : (
                    <div className="glass border-dashed p-8 rounded-[2rem] h-full flex flex-col items-center justify-center text-center gap-4 opacity-40">
                      <Sparkles className="h-8 w-8 text-station-accent" />
                      <p className="font-mono text-[10px] uppercase tracking-widest leading-relaxed">System awaiting behavioral metrics input</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Main Visualization center */}
              <div className="lg:col-span-3 space-y-8">
                <div className="glass p-8 rounded-[2rem] neo-shadow h-[450px] relative overflow-hidden">
                  <header className="flex justify-between items-start mb-12">
                    <div>
                      <h3 className="font-serif italic text-2xl text-white">Atmospheric Flux</h3>
                      <p className="font-mono text-[9px] uppercase opacity-40 mt-1 tracking-widest">Spectral history mapping • 120-second window</p>
                    </div>
                    <div className="flex items-center gap-4 bg-black/20 rounded-full px-4 py-2 border border-white/5 font-mono text-[9px] uppercase tracking-widest">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-station-accent" /> Temperature</span>
                      <div className="w-px h-3 bg-white/10" />
                      <span className="flex items-center gap-2 italic opacity-50"><span className="w-2 h-2 rounded-full bg-white/20" /> Grid Average: 24.2°C</span>
                    </div>
                  </header>

                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data?.history}>
                        <defs>
                          <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F27D26" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#F27D26" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(str) => new Date(str).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          style={{ fontSize: '9px', fontFamily: 'monospace', opacity: 0.3 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          style={{ fontSize: '9px', fontFamily: 'monospace', opacity: 0.3 }}
                          axisLine={false}
                          tickLine={false}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#0C0D0E', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            color: '#fff', 
                            fontSize: '10px', 
                            fontFamily: 'monospace',
                            borderRadius: '8px',
                            backdropFilter: 'blur(10px)'
                          }} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="temp" 
                          stroke="#F27D26" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#tempGrad)" 
                          strokeLinecap="round"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="glass p-8 rounded-[2rem]">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <Droplets className="h-4 w-4 text-station-accent/50" />
                        <span className="font-mono text-[9px] uppercase tracking-widest opacity-40">Saturation Variance</span>
                      </div>
                      <span className="font-mono text-[10px] text-station-accent">{data?.current.humidity}%</span>
                    </div>
                    <div className="h-[120px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data?.history}>
                          <Area type="stepBefore" dataKey="humidity" stroke="#38BDF8" fill="#38BDF8" fillOpacity={0.1} strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="glass-dark p-8 rounded-[2rem] border border-white/5">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <Layers className="h-4 w-4 text-white/30" />
                        <span className="font-mono text-[9px] uppercase tracking-widest opacity-40">Grid Log Output</span>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                    </div>
                    <div className="space-y-4">
                      {data?.history.slice().reverse().slice(0, 3).map((h, i) => (
                        <div key={i} className="flex justify-between items-center font-mono text-[10px] bg-white/5 p-3 rounded-lg border border-white/[0.03]">
                          <span className="opacity-30">{new Date(h.timestamp).toLocaleTimeString()}</span>
                          <span className="tracking-tight text-white/70 uppercase">
                            Precip: <span className={h.rain === 1 ? 'text-station-accent' : 'text-white/40'}>{h.rain === 1 ? 'YES' : 'NO'}</span> • {h.temp}°C
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="px-12 py-10 border-t border-white/5 opacity-40 font-mono text-[9px] uppercase tracking-[0.3em] flex flex-col md:flex-row justify-between gap-6 items-center">
        <div className="flex items-center gap-4">
          <Layers className="h-3 w-3" />
          <span>Nexus Climate Grid • Phase 4 Operational</span>
        </div>
        <div className="flex gap-8">
          {data?.current.ip && (
            <span className="text-station-accent animate-pulse font-bold">Node IP: {data.current.ip}</span>
          )}
          <span className="hover:text-station-accent transition-colors cursor-help">Latency: 24ms</span>
          <span className="hover:text-station-accent transition-colors cursor-help">Kernel: WX01.4</span>
          <span>© 2026 Core Analytics</span>
        </div>
      </footer>
    </div>
  );
}

function StatBox({ label, value, icon, trend, isAlert }: { label: string; value: string; icon: ReactNode; trend?: number; isAlert?: boolean }) {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className={`glass p-8 rounded-[2rem] transition-all duration-500 relative overflow-hidden group neo-shadow ${isAlert ? 'border-station-accent/50 active-pulse' : ''}`}
    >
      {isAlert && <div className="absolute inset-0 bg-station-accent/10 animate-pulse pointer-events-none" />}
      <div className="flex items-center gap-3 mb-6 relative z-10 transition-colors group-hover:text-station-accent">
        <div className="p-2 bg-white/5 rounded-lg border border-white/10 group-hover:bg-station-accent/20 group-hover:border-station-accent/30 transition-all">
          {icon}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100">{label}</span>
      </div>
      <div className="text-5xl font-mono tracking-tighter tabular-nums text-white relative z-10">
        {value}
      </div>
      {trend !== undefined && trend !== 0 && (
        <div className={`mt-4 font-mono text-[9px] inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white/5 relative z-10 ${trend > 0 ? 'text-red-400' : 'text-sky-400'}`}>
          <span className={trend > 0 ? 'rotate-0' : 'rotate-180'}>↑</span> 
          <span>{Math.abs(trend).toFixed(1)}° Variance detected</span>
        </div>
      )}
    </motion.div>
  );
}
