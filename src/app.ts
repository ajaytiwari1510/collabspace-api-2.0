import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.route.js";
import collegeRoutes from "./routes/college.route.js";
import profileRoutes from "./routes/profile.route.js";
import connectionRoutes from "./routes/connection.route.js";
import postRoutes from "./routes/post.route.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";

const app: Application = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Posts
app.use("/api/posts", postRoutes);

// Connections
app.use("/api/connections", connectionRoutes);

// Get Colleges
app.use("/api/colleges", collegeRoutes);

// Create or UpdateProfile
app.use("/api/profile", profileRoutes);

// Routes
app.use("/api/auth", authRoutes);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is healthy" });
});


// Error handler - HAMESHA SABSE LAST me (Express rule hai)
app.use(errorHandler);

export default app;