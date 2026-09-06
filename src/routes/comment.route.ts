import { Router } from "express";
import { remove, commentReplies } from "../controllers/comment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/:id/replies", protect, commentReplies);
router.delete("/:id", protect, remove);

export default router;