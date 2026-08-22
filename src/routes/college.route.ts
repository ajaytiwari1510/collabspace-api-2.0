import { Router } from "express";
import { searchCollege } from "../controllers/college.controller.js";

const router = Router();

router.get("/search", searchCollege);

export default router;