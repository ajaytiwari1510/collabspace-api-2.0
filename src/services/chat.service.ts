import { Conversation } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.util.js";
import mongoose from "mongoose";

export const startConversation = async (userId: string, otherUserId: string) => {
  if (userId === otherUserId) {
    throw new ApiError(400, "You cannot start a conversation with yourself");
  }

  const otherUser = await User.findById(otherUserId);

  if (!otherUser) {
    throw new ApiError(404, "User not found");
  }

  // Sort users so A-B and B-A represent the same pair.
  const sortedParticipants = [userId, otherUserId].sort();

  const existingConversation = await Conversation.findOne({
    isGroup: false,
    participants: { $all: sortedParticipants, $size: 2 },
  });

  if (existingConversation) {
    return existingConversation;
  }

  const conversation = await Conversation.create({
    participants: sortedParticipants,
    isGroup: false,
    createdBy: userId,
  });

  return conversation;
};

export const getMyConversations = async (
  userId: string,
  page: number,
  limit: number
) => {
  const skip = (page - 1) * limit;

  const conversations = await Conversation.find({
    participants: userId,
    deletedBy: { $ne: userId },
  })
    .select("-deletedBy")
    .sort({ updatedAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .populate("participants", "name")
    .populate("lastMessage.senderId", "name");

  const total = await Conversation.countDocuments({
    participants: userId,
    deletedBy: { $ne: userId },
  });

  return {
    conversations,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + conversations.length < total,
    },
  };
};

export const getMessages = async (
  conversationId: string,
  userId: string,
  page: number,
  limit: number
) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  const isParticipant = conversation.participants.some(
    (p) => p.toString() === userId
  );

  if (!isParticipant) {
    throw new ApiError(403, "You are not a participant of this conversation");
  }

  const skip = (page - 1) * limit;

  const messages = await Message.find({
    conversationId,
    isDeleted: false,
  })
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .populate("senderId", "name");

  const total = await Message.countDocuments({
    conversationId,
    isDeleted: false,
  });

  return {
    messages: messages.reverse(),
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + messages.length < total,
    },
  };
};

export const hideConversation = async (
  conversationId: string,
  userId: string
) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  const isParticipant = conversation.participants.some(
    (p) => p.toString() === userId
  );

  if (!isParticipant) {
    throw new ApiError(403, "You are not a participant of this conversation");
  }

  if (!conversation.deletedBy.some((id) => id.toString() === userId)) {
    conversation.deletedBy.push(new mongoose.Types.ObjectId(userId));
    await conversation.save();
  }

  return { message: "Conversation hidden" };
};

export const deleteMessage = async (messageId: string, userId: string) => {
  const message = await Message.findById(messageId);

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  if (message.senderId.toString() !== userId) {
    throw new ApiError(403, "You can only delete your own messages");
  }

  if (message.isDeleted) {
    throw new ApiError(400, "Message already deleted");
  }

  message.isDeleted = true;
  await message.save();

  const conversation = await Conversation.findById(message.conversationId);

  const isCurrentLastMessage =
    conversation?.lastMessage?.messageId?.toString() === messageId;

  if (isCurrentLastMessage) {
    const newLastMessage = await Message.findOne({
      conversationId: message.conversationId,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    conversation!.lastMessage = newLastMessage
      ? {
          messageId: newLastMessage._id,
          text: newLastMessage.text,
          senderId: newLastMessage.senderId,
          sentAt: newLastMessage.createdAt,
        }
      : undefined;

    await conversation!.save();
  }

  return { message: "Message deleted" };
};

export const sendMessage = async (
  conversationId: string,
  senderId: string,
  data: {
    text?: string;
    imageUrl?: string;
    messageType: "text" | "image" | "text_image";
  }
) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  const isParticipant = conversation.participants.some(
    (p) => p.toString() === senderId
  );

  if (!isParticipant) {
    throw new ApiError(403, "You are not a participant of this conversation");
  }

  const session = await mongoose.startSession();

  let populatedMessage;

  try {
    await session.withTransaction(async () => {
      const [message] = await Message.create(
        [
          {
            conversationId,
            senderId,
            text: data.text,
            imageUrl: data.imageUrl,
            messageType: data.messageType,
          },
        ],
        { session }
      );

      conversation.lastMessage = {
        messageId: message._id,
        text: message.text,
        senderId: message.senderId,
        sentAt: message.createdAt,
      };

      // A new message makes the conversation visible again.
      conversation.deletedBy = [];

      await conversation.save({ session });

      populatedMessage = await message.populate("senderId", "name");
    });
  } finally {
    await session.endSession();
  }

  const recipientIds = conversation.participants
    .map((p) => p.toString())
    .filter((id) => id !== senderId);

  return {
    message: populatedMessage,
    recipientIds,
  };
};

export const markMessagesAsRead = async (
  conversationId: string,
  userId: string
) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  const isParticipant = conversation.participants.some(
    (p) => p.toString() === userId
  );

  if (!isParticipant) {
    throw new ApiError(403, "You are not a participant of this conversation");
  }

  const result = await Message.updateMany(
    {
      conversationId,
      senderId: { $ne: userId },
      isDeleted: false,
      "readBy.userId": { $ne: userId },
    },
    {
      $addToSet: {
        readBy: { userId, readAt: new Date() },
      },
    }
  );

  return {
    conversationId,
    readByUserId: userId,
    modifiedCount: result.modifiedCount,
  };
};