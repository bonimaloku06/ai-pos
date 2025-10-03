import dotenv from "dotenv";
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  database: {
    url: process.env.DATABASE_URL!,
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "your-refresh-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  meilisearch: {
    host: process.env.MEILI_HOST || "http://localhost:7700",
    apiKey: process.env.MEILI_MASTER_KEY,
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
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