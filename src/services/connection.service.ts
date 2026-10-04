import { Connection } from "../models/connection.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.util.js";
import { createNotification } from "./notification.service.js";

export const sendConnectionRequest = async (
  senderId: string,
  receiverId: string
) => {
  if (senderId === receiverId) {
    throw new ApiError(400, "You cannot send a connection request to yourself");
  }

  const receiver = await User.findById(receiverId);

  if (!receiver) {
    throw new ApiError(404, "User not found");
  }

  const existingConnection = await Connection.findOne({
    $or: [
      { senderId, receiverId },
      { senderId: receiverId, receiverId: senderId },
    ],
  });

  if (existingConnection) {
    if (existingConnection.status === "accepted") {
      throw new ApiError(400, "You are already connected with this user");
    }

    throw new ApiError(
      400,
      "A connection request already exists between you and this user"
    );
  }

  const connection = await Connection.create({
    senderId,
    receiverId,
    status: "pending",
  });

  const sender = await User.findById(senderId);

  await createNotification({
    receiverId,
    senderId,
    type: "connection_request",
    message: `${sender?.name} sent you a connection request`,
    refId: connection._id.toString(),
    refModel: "Connection",
  });

  return connection;
};

export const acceptConnectionRequest = async (
  connectionId: string,
  userId: string
) => {
  const connection = await Connection.findById(connectionId);

  if (!connection) {
    throw new ApiError(404, "Connection request not found");
  }

  if (connection.receiverId.toString() !== userId) {
    throw new ApiError(403, "You are not authorized to accept this request");
  }

  if (connection.status !== "pending") {
    throw new ApiError(400, "This request has already been processed");
  }

  connection.status = "accepted";
  await connection.save();

  const accepter = await User.findById(userId);

  await createNotification({
    receiverId: connection.senderId.toString(),
    senderId: userId,
    type: "connection_accepted",
    message: `${accepter?.name} accepted your connection request`,
    refId: connection._id.toString(),
    refModel: "Connection",
  });

  return connection;
};

export const rejectConnectionRequest = async (
  connectionId: string,
  userId: string
) => {
  const connection = await Connection.findById(connectionId);

  if (!connection) {
    throw new ApiError(404, "Connection request not found");
  }

  if (connection.receiverId.toString() !== userId) {
    throw new ApiError(403, "You are not authorized to reject this request");
  }

  if (connection.status !== "pending") {
    throw new ApiError(400, "This request has already been processed");
  }

  await Connection.findByIdAndDelete(connectionId);

  return { message: "Connection request rejected" };
};

export const getMyConnections = async (userId: string) => {
  const connections = await Connection.find({
    $or: [{ senderId: userId }, { receiverId: userId }],
    status: "accepted",
  })
    .populate("senderId", "name")
    .populate("receiverId", "name");

  // Return only the other participant from each connection.
  const formattedConnections = connections.map((conn) => {
    const isSender = conn.senderId._id.toString() === userId;
    const otherUser = isSender ? conn.receiverId : conn.senderId;

    return {
      connectionId: conn._id,
      user: otherUser,
      connectedSince: conn.updatedAt,
    };
  });

  return formattedConnections;
};

export const getPendingRequests = async (userId: string) => {
  const requests = await Connection.find({
    receiverId: userId,
    status: "pending",
  }).populate("senderId", "name");

  return requests;
};

export const areUsersConnected = async (
  userIdA: string,
  userIdB: string
): Promise<boolean> => {
  const connection = await Connection.findOne({
    $or: [
      { senderId: userIdA, receiverId: userIdB },
      { senderId: userIdB, receiverId: userIdA },
    ],
    status: "accepted",
  });

  return !!connection;
};