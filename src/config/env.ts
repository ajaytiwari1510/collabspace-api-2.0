import { z } from "zod";
import dotenv from "dotenv";

// Step 1: .env file ko load karo process.env me
dotenv.config();

// Step 2: Schema define karo - "shape" batao ki env variables kaise hone chahiye
const envSchema = z.object({
  PORT: z.string().default("5000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
});

// Step 3: process.env ko schema ke against parse karo
const parsedEnv = envSchema.safeParse(process.env);

// Step 4: Agar validation fail ho, app crash karo clear error ke saath
if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsedEnv.error.format());
  process.exit(1);
}

// Step 5: Type-safe env object export karo, pura app isko use karega
export const env = parsedEnv.data;