import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { searchColleges } from "../services/college.service.js";
import { collegeSearchSchema } from "../validators/college.validator.js";

export const searchCollege = asyncHandler(async (req: Request, res: Response) => {
  const validatedQuery = collegeSearchSchema.parse(req.query);
  const colleges = await searchColleges(validatedQuery.q);

  res.status(200).json({
    success: true,
    data: colleges,
  });
});