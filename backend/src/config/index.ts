import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "8080"),
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "fallback_jwt_secret",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  mistralApiKey: process.env.MISTRAL_API_KEY || "",
  emailClientId: process.env.EMAIL_SERVICE_CLIENT_ID || "",
  emailClientSecret: process.env.EMAIL_SERVICE_CLIENT_SECRET || "",
  emailRedirectUri: process.env.EMAIL_REDIRECT_URI || "",
  calendarApiKey: process.env.CALENDAR_API_KEY || "",
  frontendUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV || "development",
  websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8080",
  // Hackathon 0 Compliance
  useCloudServices: process.env.USE_CLOUD_SERVICES !== "false",
  useGoogleCalendar: process.env.USE_GOOGLE_CALENDAR !== "false",
  useMistralAi: process.env.USE_MISTRAL_AI !== "false",
  vaultPath: process.env.VAULT_PATH || "./.obsidian-vault",
  dashboardPath: process.env.DASHBOARD_PATH || "./.obsidian-vault/Dashboard.md",
  logPath: process.env.LOG_PATH || "./.obsidian-vault/Logs",
  // Demo mode - skip external API calls, use simulated responses
  demoMode: process.env.DEMO_MODE === "true",
};

export default config;
