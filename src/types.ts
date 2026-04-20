export interface WeatherTelemetry {
  temp: number;
  humidity: number;
  rain: 0 | 1;
  timestamp: string;
}

export interface WeatherAnalysis {
  condition: string;
  problems: string[];
  solutions: string[];
  alert: 'SAFE' | 'WARNING' | 'DANGER';
  forecast: string;
  energyTip: string;
  simpleMessage: string;
  translations: {
    hindi: string;
    odia: string;
    bengali: string;
    tamil: string;
  };
  voiceAlert: string;
}

export interface DashboardData {
  current: WeatherTelemetry;
  history: WeatherTelemetry[];
  status: {
    system: 'online' | 'offline';
    lastUpdate: string;
  };
}
