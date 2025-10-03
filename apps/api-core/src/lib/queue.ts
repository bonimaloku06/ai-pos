import { Queue, Worker } from "bullmq";
import { config } from "../config.js";

// Create queues
export const forecastQueue = new Queue("forecast-generation", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

// Job processor for forecast generation
export const createForecastWorker = (handler: (job: any) => Promise<void>) => {
  return new Worker(
    "forecast-generation",
    async (job) => {
      console.log(`[ForecastWorker] Processing job ${job.id}`);
      await handler(job);
    },
    {
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
      },
    }
  );
};

// Schedule recurring job (runs daily at 2 AM)
export const scheduleForecastGeneration = async () => {
  await forecastQueue.add(
    "nightly-forecast",
    {},
    {
      repeat: {
        pattern: "0 2 * * *", // Cron: every day at 2 AM
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
  console.log("✓ Scheduled nightly forecast generation (2 AM daily)");
};