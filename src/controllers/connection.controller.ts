import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  getMyConnections,
  getPendingRequests,
} from "../services/connection.service.js";
import { ApiError } from "../utils/apiError.util.js";
import { sendConnectionRequestSchema } from "../validators/connection.validator.js";

export const sendRequest = asyncHandler(async (req: Request, res: Response) => {
  const senderId = req.user!.userId;
  const { receiverId } = sendConnectionRequestSchema.parse(req.body);

  const connection = await sendConnectionRequest(senderId, receiverId);

  res.status(201).json({
    success: true,
    message: "Connection request sent",
    data: connection,
  });
});

export const acceptRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const connectionId = req.params.id;

  if (!connectionId || typeof connectionId !== "string") {
    throw new ApiError(400, "Connection ID is required");
  }

  const connection = await acceptConnectionRequest(connectionId, userId);

  res.status(200).json({
    success: true,
    message: "Connection request accepted",
    data: connection,
  });
});

export const rejectRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const connectionId = req.params.id;

  if (!connectionId || typeof connectionId !== "string") {
    throw new ApiError(400, "Connection ID is required");
  }

  const result = await rejectConnectionRequest(connectionId, userId);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

export const getConnections = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const connections = await getMyConnections(userId);

  res.status(200).json({
    success: true,
    data: connections,
  });
});

export const getPending = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const requests = await getPendingRequests(userId);

  res.status(200).json({
    success: true,
    data: requests,
  });
});