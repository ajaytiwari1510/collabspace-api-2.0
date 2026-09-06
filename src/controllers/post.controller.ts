import { Request, Response } from "express";
import { getPaginationParams } from "../utils/pagination.util.js";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import {
  createPost,
  getFeed,
  getUserPosts,
  deletePost,
} from "../services/post.service.js";
import { createPostSchema } from "../validators/post.validator.js";
import { getParam } from "../utils/getParam.util.js";

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
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);

  const result = await getFeed(page, limit);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const userPosts = asyncHandler(async (req: Request, res: Response) => {
  const targetUserId = getParam(req.params.userId, "User ID");
  const viewerId = req.user!.userId;

  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);

  const result = await getUserPosts(targetUserId, viewerId, page, limit);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const postId = getParam(req.params.id, "Post ID");

  const result = await deletePost(postId, userId);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});