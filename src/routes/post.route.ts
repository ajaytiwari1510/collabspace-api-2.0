import { Router } from "express";
import { create, feed, userPosts, remove } from "../controllers/post.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.post("/", protect, upload.single("image"), create);
router.get("/feed", protect, feed);
router.get("/user/:userId", protect, userPosts);
router.delete("/:id", protect, remove);

export default router;