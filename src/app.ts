import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";

import authRoutes from "./routes/auth.route.js";
import collegeRoutes from "./routes/college.route.js";
import profileRoutes from "./routes/profile.route.js";
import connectionRoutes from "./routes/connection.route.js";
import postRoutes from "./routes/post.route.js";
import projectRoutes from "./routes/project.route.js";
import notificationRoutes from "./routes/notification.route.js";
import chatRoutes from "./routes/chat.route.js";
import commentRoutes from "./routes/comment.route.js";

import { globalLimiter } from "./middlewares/rateLimiter.middleware.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";

const app: Application = express();

app.use(helmet());

app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));

app.use(morgan("dev"));

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

app.use(globalLimiter);

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is healthy",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/colleges", collegeRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api", chatRoutes);

// Comment-specific actions (delete comment, fetch replies) — commentId-based, not nested under posts
app.use("/api/comments", commentRoutes);

app.use(errorHandler);

export default app;