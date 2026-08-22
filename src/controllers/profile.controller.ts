import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { getProfile, updateProfile } from "../services/profile.service.js";
import { updateProfileSchema } from "../validators/profile.validator.js";

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const profile = await getProfile(userId);

  res.status(200).json({
    success: true,
    data: profile,
  });
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const validatedData = updateProfileSchema.parse(req.body);

  const profile = await updateProfile(userId, validatedData);

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: profile,
  });
});