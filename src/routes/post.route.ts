import { Router } from "express";
import { create, feed, userPosts, remove } from "../controllers/post.controller.js";
import { like, unlike } from "../controllers/like.controller.js";
import { create as createComment, postComments } from "../controllers/comment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.post("/", protect, upload.single("image"), create);
router.get("/feed", protect, feed);
router.get("/user/:userId", protect, userPosts);
router.delete("/:id", protect, remove);

router.post("/:id/like", protect, like);
router.delete("/:id/like", protect, unlike);

router.post("/:id/comments", protect, createComment);
router.get("/:id/comments", protect, postComments);

export default router;