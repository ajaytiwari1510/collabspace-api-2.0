import { Notification } from "../models/notification.model.js";
import type { NotificationType } from "../models/notification.model.js";
import { ApiError } from "../utils/apiError.util.js";


interface CreateNotificationInput {
    receiverId: string;
    senderId: string;
    type: NotificationType;
    message: string;
    refId?: string;
    refModel?: "Connection" | "Project" | "ProjectJoinRequest";
}

export const createNotification = async (input: CreateNotificationInput) => {
    // Self-notification prevention - silently skip, no error
    if(input.senderId && input.senderId === input.receiverId){
        return null;
    }

    const notification = Notification.create({
        receiverId: input.receiverId,
        senderId: input.senderId,
        type: input.type,
        message: input.message,
        refId: input.refId,
        refModel: input.refModel,
    });

    return notification;
}

export const createNotificationForMany = async(
    receiverIds: string[],
    senderId: string,
    type: NotificationType,
    message: string,
    refId?: string,
    refModel?: "Connection" | "Project" | "ProjectJoinRequest",
) => {
    // Duplicate receivers hatao, aur khud ko bhi hatao (agar list me ho)
    const uniqueReceivers = [...new Set(receiverIds)].filter((id) => id !== senderId);

    const notifications = await Promise.all(
        uniqueReceivers.map((receiverId) => 
        createNotification({ receiverId, senderId, type, message, refId, refModel })
        )
    );

    return notifications;
};


export const getMyNotifications = async (
  userId: string,
  page: number,
  limit: number,
  unread = false
) => {
  const skip = (page - 1) * limit;

  const filter = {
    receiverId: userId,
    ...(unread && { isRead: false }),
  };

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("senderId", "name");

  const total = await Notification.countDocuments(filter);

  const unreadCount = await Notification.countDocuments({
    receiverId: userId,
    isRead: false,
  });

  return {
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + notifications.length < total,
    },
  };
};

export const markAsRead = async( notificationId: string, userId: string ) => {
    const notification = await Notification.findById(notificationId);

    if(!notification){
        throw new ApiError(404, "Notification Not Found");
    }

    if(notification.receiverId.toString() !== userId){
        throw new ApiError(403, "You are not authorized to update this notification");
    }

    notification.isRead = true;
    await notification.save();

    return notification;
};

export const markAllAsRead = async (userId: string) => {
    await Notification.updateMany(
        { receiverId: userId, isRead: false },
        { isRead: true },
    );

    return { message: "All notifications maked as Read"};
}

export const deleteNotification = async ( notificationId: string, userId: string ) => {
    const notification = await Notification.findById(notificationId);

    if(!notification){
        throw new ApiError(404, "Notification not found");
    }

    if(notification.receiverId.toString() !== userId){
        throw new ApiError(403, "You are not authorized to delete this notification");
    }

    await Notification.findByIdAndDelete(notificationId);
    return { message: "Notification Deleted" };
}

