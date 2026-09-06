import { Router } from "express";
import { register, login, refresh, logout } from "../controllers/auth.controller.js";
import { authLimiter } from "../middlewares/rateLimiter.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { protect } from "../middlewares/auth.middleware.js"; // naya import
import { registerSchema, loginSchema } from "../validators/auth.validator.js";

const router = Router();


router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", protect, logout); // naya route - protect middleware pehle chalega

export default router;