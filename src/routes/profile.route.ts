import { Router } from "express";
import { getMyProfile, updateMyProfile } from "../controllers/profile.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/me", protect, getMyProfile);
router.put("/me", protect, updateMyProfile);

export default router;