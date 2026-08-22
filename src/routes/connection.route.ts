import { Router } from "express";
import {
  sendRequest,
  acceptRequest,
  rejectRequest,
  getConnections,
  getPending,
} from "../controllers/connection.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/request", protect, sendRequest);
router.put("/:id/accept", protect, acceptRequest);
router.delete("/:id/reject", protect, rejectRequest);
router.get("/", protect, getConnections);
router.get("/pending", protect, getPending);

export default router;