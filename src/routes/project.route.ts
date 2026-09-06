import { Router } from "express";
import {
  create,
  discover,
  myProjects,
  join,
  getPendingRequests,
  accept,
  reject,
  leave,
  remove,
  transfer,
  remove_project,
} from "../controllers/project.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { transferOwnershipSchema } from "../validators/project.validator.js";

const router = Router();

// Zaroori: Specific/fixed routes, dynamic (:id) routes se PEHLE
router.get("/discover", protect, discover);
router.get("/my", protect, myProjects);

router.post("/", protect, create);
router.post("/:id/join", protect, join);
router.get("/:id/requests", protect, getPendingRequests);
router.put("/:id/requests/:requestId/accept", protect, accept);
router.delete("/:id/requests/:requestId/reject", protect, reject);
router.post("/:id/leave", protect, leave);
router.delete("/:id/members/:memberId", protect, remove);
router.put("/:id/transfer-ownership", protect, validate(transferOwnershipSchema), transfer);
router.delete("/:id", protect, remove_project);

export default router;