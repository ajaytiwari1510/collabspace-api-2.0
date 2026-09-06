import { Router } from "express";
import {
  getNotifications,
  markOneAsRead,
  markAllRead,
  removeNotification,
} from "../controllers/notification.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", protect, getNotifications);
router.patch("/read-all", protect, markAllRead);
router.patch("/:id/read", protect, markOneAsRead);
router.delete("/:id", protect, removeNotification);

export default router;