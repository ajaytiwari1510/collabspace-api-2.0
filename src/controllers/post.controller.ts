import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import {
  createPost,
  getFeed,
  getUserPosts,
  deletePost,
} from "../services/post.service.js";
import { createPostSchema } from "../validators/post.validator.js";
import { ApiError } from "../utils/apiError.util.js";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const validatedData = createPostSchema.parse(req.body);

  const imageBuffer = req.file?.buffer;

  const post = await createPost(userId, validatedData, imageBuffer);

  res.status(201).json({
    success: true,
    message: "Post created successfully",
    data: post,
  });
});

export const feed = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const result = await getFeed(page, limit);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const userPosts = asyncHandler(async (req: Request, res: Response) => {
  const targetUserId = req.params.userId;
  const viewerId = req.user!.userId;

  if (!targetUserId || typeof targetUserId !== "string") {
    throw new ApiError(400, "User ID is required");
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const result = await getUserPosts(targetUserId, viewerId, page, limit);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const postId = req.params.id;

  if (!postId || typeof postId !== "string") {
    throw new ApiError(400, "Post ID is required");
  }

  const result = await deletePost(postId, userId);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});