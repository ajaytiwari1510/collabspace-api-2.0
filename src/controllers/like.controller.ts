import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { getParam } from "../utils/getParam.util.js";
import { likePost, unlikePost } from "../services/like.service.js";

export const like = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const postId = getParam(req.params.id, "Post ID");

  const result = await likePost(postId, userId);

  res.status(200).json({ success: true, message: result.message });
});

export const unlike = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const postId = getParam(req.params.id, "Post ID");

  const result = await unlikePost(postId, userId);

  res.status(200).json({ success: true, message: result.message });
});