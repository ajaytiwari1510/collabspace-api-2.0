import http from "http";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { initializeSocket } from "./socket/index.js";

const httpServer = http.createServer(app);

initializeSocket(httpServer);

const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    httpServer.listen(env.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();