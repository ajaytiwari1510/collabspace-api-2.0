import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { getParam } from "../utils/getParam.util.js";
import { getPaginationParams } from "../utils/pagination.util.js";
import { startConversationSchema } from "../validators/chat.validator.js";
import {
  startConversation,
  getMyConversations,
  getMessages,
  hideConversation,
  deleteMessage,
} from "../services/chat.service.js";

export const start = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { otherUserId } = startConversationSchema.parse(req.body);

  const conversation = await startConversation(userId, otherUserId);

  res.status(200).json({ success: true, data: conversation });
});

export const myConversations = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);

  const result = await getMyConversations(userId, page, limit);

  res.status(200).json({ success: true, data: result });
});

export const messages = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const conversationId = getParam(req.params.id, "Conversation ID");
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);

  const result = await getMessages(conversationId, userId, page, limit);

  res.status(200).json({ success: true, data: result });
});

export const hideChat = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const conversationId = getParam(req.params.id, "Conversation ID");

  const result = await hideConversation(conversationId, userId);

  res.status(200).json({ success: true, message: result.message });
});

export const removeMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const messageId = getParam(req.params.messageId, "Message ID");

  const result = await deleteMessage(messageId, userId);

  res.status(200).json({ success: true, message: result.message });
});