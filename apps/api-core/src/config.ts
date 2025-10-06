import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from api-core directory first
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Then load from project root (will not override existing vars)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  database: {
    url: process.env.DATABASE_URL!,
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6380",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "your-refresh-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  meilisearch: {
    host: process.env.MEILI_HOST || "http://localhost:7701",
    apiKey: process.env.MEILI_MASTER_KEY,
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9100",
    accessKey: process.env.S3_ACCESS_KEY || "minioadmin",
    secretKey: process.env.S3_SECRET_KEY || "minioadmin123",
    bucket: process.env.S3_BUCKET || "pharmacy-pos",
  },
  forecast: {
    serviceUrl: process.env.FORECAST_SVC_URL || "http://localhost:8000",
  },
  cors: {
    origins: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:5173"],
  },
};