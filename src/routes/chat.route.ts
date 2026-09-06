import { Router } from "express";
import {
  start,
  myConversations,
  messages,
  hideChat,
  removeMessage,
} from "../controllers/chat.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/conversations", protect, start);
router.get("/conversations", protect, myConversations);
router.get("/conversations/:id/messages", protect, messages);
router.delete("/conversations/:id", protect, hideChat);
router.delete("/messages/:messageId", protect, removeMessage);

export default router;