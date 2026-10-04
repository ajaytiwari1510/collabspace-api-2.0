import mongoose from "mongoose";
import { beforeAll, afterAll } from "vitest";
import { env } from "../src/config/env.js";

beforeAll(async () => {
  await mongoose.connect(env.MONGO_URI);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});