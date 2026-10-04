import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyAccessToken } from "../utils/jwt.util.js";
import { Conversation } from "../models/conversation.model.js";
import { markMessagesAsRead, sendMessage } from "../services/chat.service.js";
import { env } from "../config/env.js";
import { conversationIdSchema, sendMessageSchema } from "../validators/chat.validator.js";

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

// Module-level Map — track kitne active connections har userId ke hain
const onlineUsers = new Map<string, number>();

let ioInstance: SocketIOServer;

export const initializeSocket = (httpServer: HTTPServer) => {
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CLIENT_URL,
    credentials: true,
  },
});

  ioInstance = io; // store reference

  // Problem: Anyone without a valid access token could connect to Socket.IO.
  // Solution: Verify the access token before allowing the socket connection.
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication token missing"));
    }

    try {
      const decoded = verifyAccessToken(token);

      socket.userId = decoded.userId;

      next();
    } catch (error) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(
      `🔌 User connected: ${socket.userId}, socket: ${socket.id}`
    );

    // Har user apne khud ke userId-room mein join — offline delivery ke liye zaroori
    socket.join(socket.userId!);

    // Presence tracking: is user ka pehla connection hai kya?
    const userId = socket.userId!;
    const currentCount = onlineUsers.get(userId) ?? 0;
    onlineUsers.set(userId, currentCount + 1);

    if (currentCount === 0) {
      socket.broadcast.emit("user_online", { userId });
    }

    // Problem: A user could try to join any conversation by sending its ID.
    // Solution: Verify that the authenticated user is a participant before joining.
    socket.on(
      "join_conversation",
      async (
       payload: unknown,
       ack?: (response: { success: boolean; message?: string }) => void
      ) => {
      const parsed = conversationIdSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("error", { message: parsed.error.issues[0].message });
        return;
      }
      const { conversationId } = parsed.data;

      try {
        if (!socket.userId) {
          return;
        }

        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.userId,
        });

        if (!conversation) {
          socket.emit("error", {
            message: "You are not a participant of this conversation",
          });
          return;
        }

        socket.join(conversationId);
        ack?.({ success: true });

        console.log(
          `👥 User ${socket.userId} joined conversation ${conversationId}`
        );
      } catch (error) {
        console.error("❌ join_conversation error:", error);
        socket.emit("error", {
          message: "Unable to join conversation",
        });
      }
    });

    // Problem: The socket should not remain in a conversation room after leaving it.
    // Solution: Remove the socket from the conversation room.
    socket.on("leave_conversation", (payload: unknown) => {
      const parsed = conversationIdSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("error", { message: parsed.error.issues[0].message });
        return;
      }
      const { conversationId } = parsed.data;

      socket.leave(conversationId);

      console.log(
        `🚪 User ${socket.userId} left conversation ${conversationId}`
      );
    });

    // Problem: Sender aur receiver ko real-time message chahiye, DB save ke saath.
    // Solution: Payload validate karo, service se save + recipientIds nikalo, receivers ko emit karo.
    socket.on(
      "send_message",
      async (
        payload: unknown,
        callback?: (response: { success: boolean; message?: any; error?: string }) => void
      ) => {
        const parsed = sendMessageSchema.safeParse(payload);
        if (!parsed.success) {
          callback?.({ success: false, error: parsed.error.issues[0].message });
          return;
        }

        try {
          const { message, recipientIds } = await sendMessage(
            parsed.data.conversationId,
            socket.userId!,
            {
              text: parsed.data.text,
              imageUrl: parsed.data.imageUrl,
              messageType: parsed.data.messageType,
            }
          );

          callback?.({ success: true, message });

          recipientIds.forEach((recipientId) => {
            io.to(recipientId).emit("receive_message", message);
          });
        } catch (error: any) {
          callback?.({ success: false, error: error.message || "Failed to send message" });
        }
      }
    );

    // Problem: An unauthorized socket could broadcast typing events into any room.
    // Solution: Allow typing events only if the socket is already inside the verified room.
    socket.on("typing_start", (payload: unknown) => {
      const parsed = conversationIdSchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }
      const { conversationId } = parsed.data;

      if (!socket.rooms.has(conversationId)) {
        return;
      }

      socket.to(conversationId).emit("typing_start", {
        conversationId,
        userId: socket.userId,
      });
    });

    // Problem: An unauthorized socket could broadcast typing-stop events into any room.
    // Solution: Allow the event only if the socket is already inside the verified room.
    socket.on("typing_stop", (payload: unknown) => {
      const parsed = conversationIdSchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }
      const { conversationId } = parsed.data;

      if (!socket.rooms.has(conversationId)) {
        return;
      }

      socket.to(conversationId).emit("typing_stop", {
        conversationId,
        userId: socket.userId,
      });
    });

    socket.on("message_read", async (payload: unknown) => {
      const parsed = conversationIdSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("error", { message: parsed.error.issues[0].message });
        return;
      }
      const { conversationId } = parsed.data;

      try {
        if (!socket.rooms.has(conversationId)) {
          return;
        }

        const result = await markMessagesAsRead(conversationId, socket.userId!);

        if (result.modifiedCount > 0) {
          socket.to(conversationId).emit("message_read", {
            conversationId,
            readByUserId: socket.userId,
          });
        }
      } catch (error) {
        socket.emit("error", { message: "Unable to mark messages as read" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.userId}`);

      const newCount = (onlineUsers.get(userId) ?? 1) - 1;

      if (newCount <= 0) {
        onlineUsers.delete(userId);
        socket.broadcast.emit("user_offline", { userId });
      } else {
        onlineUsers.set(userId, newCount);
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!ioInstance) {
    throw new Error("Socket.io not initialized yet");
  }
  return ioInstance;
};