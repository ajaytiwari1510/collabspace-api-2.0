import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { getParam } from "../utils/getParam.util.js";
import { getPaginationParams } from "../utils/pagination.util.js";
import { createCommentSchema } from "../validators/comment.validator.js";
import {
  createComment,
  deleteComment,
  getPostComments,
  getCommentReplies,
} from "../services/comment.service.js";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const postId = getParam(req.params.id, "Post ID");
  const { text, parentCommentId } = createCommentSchema.parse(req.body);

  const comment = await createComment(postId, userId, text, parentCommentId);

  res.status(201).json({ success: true, data: comment });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const commentId = getParam(req.params.id, "Comment ID");

  const result = await deleteComment(commentId, userId);

  res.status(200).json({ success: true, message: result.message });
});

export const postComments = asyncHandler(async (req: Request, res: Response) => {
  const postId = getParam(req.params.id, "Post ID");
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);

  const result = await getPostComments(postId, page, limit);

  res.status(200).json({ success: true, data: result });
});

export const commentReplies = asyncHandler(async (req: Request, res: Response) => {
  const commentId = getParam(req.params.id, "Comment ID");
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);

  const result = await getCommentReplies(commentId, page, limit);

  res.status(200).json({ success: true, data: result });
});