import { Request, Response } from "express";
import { getPaginationParams } from "../utils/pagination.util.js";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { ApiError } from "../utils/apiError.util.js";
import { getParam } from "../utils/getParam.util.js";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../services/notification.service.js";


export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const { page, limit } = getPaginationParams(
    req.query.page,
    req.query.limit
  );

  const unreadQuery = req.query.unread;

  if (
    unreadQuery !== undefined &&
    unreadQuery !== "true" &&
    unreadQuery !== "false"
  ) {
    throw new ApiError(
      400,
      "The unread query parameter must be true or false"
    );
  }

  const unread = unreadQuery === "true";

  const result = await getMyNotifications(
    userId,
    page,
    limit,
    unread
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const markOneAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const notificationId = getParam(req.params.id, "Notification ID");

  const notification = await markAsRead(notificationId, userId);

  res.status(200).json({ success: true, data: notification });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const result = await markAllAsRead(userId);

  res.status(200).json({ success: true, message: result.message });
});

export const removeNotification = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const notificationId = getParam(req.params.id, "Notification ID");

  const result = await deleteNotification(notificationId, userId);

  res.status(200).json({ success: true, message: result.message });
});

