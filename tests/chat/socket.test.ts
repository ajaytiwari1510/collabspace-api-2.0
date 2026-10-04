import http from "http";
import { io as Client } from "socket.io-client";
import mongoose from "mongoose";
import type { Server as SocketIOServer } from "socket.io";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import app from "../../src/app.js";
import { initializeSocket } from "../../src/socket/index.js";
import { User } from "../../src/models/user.model.js";
import { generateAccessToken } from "../../src/utils/jwt.util.js";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";
import { Conversation } from "../../src/models/conversation.model.js";
import { Message } from "../../src/models/message.model.js";

describe("Socket.IO authentication", () => {
  let httpServer: http.Server;
  let port: number;
  let io: SocketIOServer;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();

    httpServer = http.createServer(app);
    io = initializeSocket(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();

        if (typeof address === "object" && address !== null) {
          port = address.port;
        }

        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("should connect with a valid access token", async () => {
    const user = await User.create({
      name: "Socket Test User",
      email: "socket-test@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    const token = generateAccessToken({
      userId: user._id.toString(),
      role: "user",
    });

    const socket = Client(`http://localhost:${port}`, {
      auth: {
        token,
      },
    });

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => {
        resolve();
      });

      socket.on("connect_error", (error) => {
        reject(error);
      });
    });

    expect(socket.connected).toBe(true);

    socket.disconnect();

    expect(socket.connected).toBe(false);
  });

  it("should reject connection without an access token", async () => {
  const socket = Client(`http://localhost:${port}`);

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", () => {
      reject(new Error("Socket should not connect without a token"));
    });

    socket.on("connect_error", (error) => {
      expect(error.message).toBe("Authentication token missing");
      resolve();
    });
  });

  expect(socket.connected).toBe(false);

  socket.disconnect();
  });

  it("should reject connection with an invalid access token", async () => {
  const socket = Client(`http://localhost:${port}`, {
    auth: {
      token: "invalid-access-token",
    },
  });

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", () => {
      reject(new Error("Socket should not connect with an invalid token"));
    });

    socket.on("connect_error", (error) => {
      expect(error.message).toBe("Invalid or expired token");
      resolve();
    });
  });

  expect(socket.connected).toBe(false);

  socket.disconnect();
  });

  it("should reject connection with an expired access token", async () => {
  const user = await User.create({
    name: "Expired Socket User",
    email: "expired-socket@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const expiredToken = jwt.sign(
    {
      userId: user._id.toString(),
      role: "user",
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: -1,
    }
  );

  const socket = Client(`http://localhost:${port}`, {
    auth: {
      token: expiredToken,
    },
  });

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", () => {
      reject(new Error("Socket should not connect with an expired token"));
    });

    socket.on("connect_error", (error) => {
      expect(error.message).toBe("Invalid or expired token");
      resolve();
    });
  });

  expect(socket.connected).toBe(false);

  socket.disconnect();
  });

  it("should allow a conversation participant to join the conversation room", async () => {
  const user1 = await User.create({
    name: "Socket User One",
    email: "socket-user-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Socket User Two",
    email: "socket-user-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const socket = Client(`http://localhost:${port}`, {
    auth: {
      token,
    },
  });

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);

    socket.on("connect_error", (error) => {
      reject(error);
    });
  });

await new Promise<void>((resolve, reject) => {
  socket.emit(
    "join_conversation",
    {
      conversationId: conversation._id.toString(),
    },
    (response: { success: boolean; message?: string }) => {
      if (!response.success) {
        reject(new Error(response.message ?? "Failed to join conversation"));
        return;
      }

      resolve();
    }
  );
});

  const connectedSocket = io.sockets.sockets.get(socket.id!);

  expect(connectedSocket).toBeDefined();
  expect(
    connectedSocket!.rooms.has(conversation._id.toString())
  ).toBe(true);

  socket.disconnect();
  });

  it("should reject a non-participant from joining a conversation room", async () => {
  const user1 = await User.create({
    name: "Conversation User One",
    email: "conversation-user-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Conversation User Two",
    email: "conversation-user-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const attacker = await User.create({
    name: "Non Participant",
    email: "non-participant@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const token = generateAccessToken({
    userId: attacker._id.toString(),
    role: "user",
  });

  const socket = Client(`http://localhost:${port}`, {
    auth: {
      token,
    },
  });

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);

    socket.on("connect_error", reject);
  });

  const errorPromise = new Promise<{ message: string }>((resolve) => {
    socket.once("error", resolve);
  });

  socket.emit("join_conversation", {
    conversationId: conversation._id.toString(),
  });

  const error = await errorPromise;

  expect(error.message).toBe(
    "You are not a participant of this conversation"
  );

  await new Promise((resolve) => setTimeout(resolve, 50));

  const connectedSocket = io.sockets.sockets.get(socket.id!);

  expect(connectedSocket).toBeDefined();
  expect(
    connectedSocket!.rooms.has(conversation._id.toString())
  ).toBe(false);

  socket.disconnect();
  });

  it("should reject an invalid conversation ID when joining a conversation", async () => {
  const user = await User.create({
    name: "Invalid Conversation User",
    email: "invalid-conversation-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const socket = Client(`http://localhost:${port}`, {
    auth: {
      token,
    },
  });

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);

    socket.on("connect_error", reject);
  });

const errorPromise = new Promise<{ message: string }>((resolve) => {
  socket.once("error", (error) => {
    console.log("JOIN ERROR:", error);
    resolve(error);
  });
});

socket.emit("join_conversation", {
  conversationId: "invalid-conversation-id",
});

const error = await Promise.race([
  errorPromise,
  new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("Timed out waiting for join_conversation error"));
    }, 3000);
  }),
]);

expect(error).toBeDefined();
expect(error.message).toBeTypeOf("string");

socket.disconnect();
  });

  it("should allow a participant to leave a conversation room", async () => {
  const user1 = await User.create({
    name: "Leave User One",
    email: "leave-user-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Leave User Two",
    email: "leave-user-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const socket = Client(`http://localhost:${port}`, {
    auth: {
      token,
    },
  });

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
  });

  const conversationId = conversation._id.toString();

await new Promise<void>((resolve, reject) => {
  socket.emit(
    "join_conversation",
    { conversationId },
    (response: { success: boolean; message?: string }) => {
      if (!response.success) {
        reject(new Error(response.message ?? "Failed to join conversation"));
        return;
      }

      resolve();
    }
  );
});

  const connectedSocket = io.sockets.sockets.get(socket.id!);

  expect(connectedSocket).toBeDefined();
  expect(connectedSocket!.rooms.has(conversationId)).toBe(true);

  socket.emit("leave_conversation", {
    conversationId,
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(connectedSocket!.rooms.has(conversationId)).toBe(false);

  socket.disconnect();
  });

  it("should reject an invalid conversation ID when leaving a conversation", async () => {
  const user = await User.create({
    name: "Invalid Leave User",
    email: "invalid-leave-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const socket = Client(`http://localhost:${port}`, {
    auth: {
      token,
    },
  });

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
  });

  socket.on("error", (error) => {
    console.log("LEAVE ERROR RECEIVED:", error);
  });

  socket.emit("leave_conversation", {
    conversationId: "invalid-conversation-id",
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  expect(socket.connected).toBe(true);

  socket.disconnect();
  });

  it("should send a text message to the conversation participant", async () => {
  const user1 = await User.create({
    name: "Sender User",
    email: "sender-message@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Receiver User",
    email: "receiver-message@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const senderToken = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const receiverToken = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const senderSocket = Client(`http://localhost:${port}`, {
    auth: {
      token: senderToken,
    },
  });

  const receiverSocket = Client(`http://localhost:${port}`, {
    auth: {
      token: receiverToken,
    },
  });

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      senderSocket.on("connect", resolve);
      senderSocket.on("connect_error", reject);
    }),
    new Promise<void>((resolve, reject) => {
      receiverSocket.on("connect", resolve);
      receiverSocket.on("connect_error", reject);
    }),
  ]);

  const receiveMessagePromise = new Promise<any>((resolve) => {
    receiverSocket.once("receive_message", resolve);
  });

  const callbackPromise = new Promise<any>((resolve) => {
    senderSocket.emit(
      "send_message",
      {
        conversationId: conversation._id.toString(),
        text: "Hello from sender",
        messageType: "text",
      },
      resolve
    );
  });

  const [callbackResponse, receivedMessage] = await Promise.all([
    callbackPromise,
    receiveMessagePromise,
  ]);

  expect(callbackResponse.success).toBe(true);
  expect(callbackResponse.message.text).toBe("Hello from sender");
  expect(callbackResponse.message.messageType).toBe("text");

  expect(receivedMessage.text).toBe("Hello from sender");
  expect(receivedMessage.messageType).toBe("text");
  expect(receivedMessage.senderId._id.toString()).toBe(user1._id.toString());

  const savedMessage = await Message.findOne({
    conversationId: conversation._id,
  });

  expect(savedMessage).not.toBeNull();
  expect(savedMessage!.senderId.toString()).toBe(user1._id.toString());
  expect(savedMessage!.text).toBe("Hello from sender");
  expect(savedMessage!.messageType).toBe("text");

  const updatedConversation = await Conversation.findById(conversation._id);

  expect(updatedConversation!.lastMessage).toBeDefined();
  expect(updatedConversation!.lastMessage!.messageId.toString()).toBe(
    savedMessage!._id.toString()
  );
  expect(updatedConversation!.lastMessage!.text).toBe("Hello from sender");

  senderSocket.disconnect();
  receiverSocket.disconnect();
  });

  it("should reject a message from a non-participant", async () => {
  const user1 = await User.create({
    name: "Conversation User One",
    email: "conversation-user-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Conversation User Two",
    email: "conversation-user-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user3 = await User.create({
    name: "Non Participant User",
    email: "non-participant@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const token = generateAccessToken({
    userId: user3._id.toString(),
    role: "user",
  });

  const socket = Client(`http://localhost:${port}`, {
    auth: {
      token,
    },
  });

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
  });

  const callbackResponse = await new Promise<any>((resolve) => {
    socket.emit(
      "send_message",
      {
        conversationId: conversation._id.toString(),
        text: "Unauthorized message",
        messageType: "text",
      },
      resolve
    );
  });

  expect(callbackResponse.success).toBe(false);
  expect(callbackResponse.error).toBe(
    "You are not a participant of this conversation"
  );

  const messageCount = await Message.countDocuments({
    conversationId: conversation._id,
  });

  expect(messageCount).toBe(0);

  socket.disconnect();
  });

  it("should reject an invalid send_message payload", async () => {
  const user1 = await User.create({
    name: "Invalid Payload User One",
    email: "invalid-payload-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Invalid Payload User Two",
    email: "invalid-payload-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const socket = Client(`http://localhost:${port}`, {
    auth: {
      token,
    },
  });

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
  });

  const callbackResponse = await new Promise<any>((resolve) => {
    socket.emit(
      "send_message",
      {
        conversationId: conversation._id.toString(),
        text: "Hello",
      },
      resolve
    );
  });

  expect(callbackResponse.success).toBe(false);
  expect(callbackResponse.error).toBeTypeOf("string");

  const messageCount = await Message.countDocuments({
    conversationId: conversation._id,
  });

  expect(messageCount).toBe(0);

  socket.disconnect();
  });

  it("should send an image message to the conversation participant", async () => {
  const user1 = await User.create({
    name: "Image Sender",
    email: "image-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Image Receiver",
    email: "image-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const receiverToken = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const senderSocket = Client(`http://localhost:${port}`, {
    auth: { token },
  });

  const receiverSocket = Client(`http://localhost:${port}`, {
    auth: { token: receiverToken },
  });

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      senderSocket.on("connect", resolve);
      senderSocket.on("connect_error", reject);
    }),
    new Promise<void>((resolve, reject) => {
      receiverSocket.on("connect", resolve);
      receiverSocket.on("connect_error", reject);
    }),
  ]);

  const receiveMessagePromise = new Promise<any>((resolve) => {
    receiverSocket.once("receive_message", resolve);
  });

  const callbackPromise = new Promise<any>((resolve) => {
    senderSocket.emit(
      "send_message",
      {
        conversationId: conversation._id.toString(),
        imageUrl: "https://example.com/image.jpg",
        messageType: "image",
      },
      resolve
    );
  });

  const [callbackResponse, receivedMessage] = await Promise.all([
    callbackPromise,
    receiveMessagePromise,
  ]);

  expect(callbackResponse.success).toBe(true);
  expect(callbackResponse.message.messageType).toBe("image");
  expect(callbackResponse.message.imageUrl).toBe(
    "https://example.com/image.jpg"
  );

  expect(receivedMessage.messageType).toBe("image");
  expect(receivedMessage.imageUrl).toBe(
    "https://example.com/image.jpg"
  );

  const savedMessage = await Message.findOne({
    conversationId: conversation._id,
  });

  expect(savedMessage).not.toBeNull();
  expect(savedMessage!.messageType).toBe("image");
  expect(savedMessage!.imageUrl).toBe(
    "https://example.com/image.jpg"
  );
  expect(savedMessage!.text).toBeUndefined();

  senderSocket.disconnect();
  receiverSocket.disconnect();
  });

  it("should send a text and image message to the conversation participant", async () => {
  const user1 = await User.create({
    name: "Text Image Sender",
    email: "text-image-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Text Image Receiver",
    email: "text-image-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const senderToken = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const receiverToken = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const senderSocket = Client(`http://localhost:${port}`, {
    auth: { token: senderToken },
  });

  const receiverSocket = Client(`http://localhost:${port}`, {
    auth: { token: receiverToken },
  });

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      senderSocket.on("connect", resolve);
      senderSocket.on("connect_error", reject);
    }),
    new Promise<void>((resolve, reject) => {
      receiverSocket.on("connect", resolve);
      receiverSocket.on("connect_error", reject);
    }),
  ]);

  const receiveMessagePromise = new Promise<any>((resolve) => {
    receiverSocket.once("receive_message", resolve);
  });

  const callbackPromise = new Promise<any>((resolve) => {
    senderSocket.emit(
      "send_message",
      {
        conversationId: conversation._id.toString(),
        text: "Check this image",
        imageUrl: "https://example.com/image.jpg",
        messageType: "text_image",
      },
      resolve
    );
  });

  const [callbackResponse, receivedMessage] = await Promise.all([
    callbackPromise,
    receiveMessagePromise,
  ]);

  expect(callbackResponse.success).toBe(true);
  expect(callbackResponse.message.messageType).toBe("text_image");
  expect(callbackResponse.message.text).toBe("Check this image");
  expect(callbackResponse.message.imageUrl).toBe(
    "https://example.com/image.jpg"
  );

  expect(receivedMessage.messageType).toBe("text_image");
  expect(receivedMessage.text).toBe("Check this image");
  expect(receivedMessage.imageUrl).toBe(
    "https://example.com/image.jpg"
  );

  const savedMessage = await Message.findOne({
    conversationId: conversation._id,
  });

  expect(savedMessage).not.toBeNull();
  expect(savedMessage!.messageType).toBe("text_image");
  expect(savedMessage!.text).toBe("Check this image");
  expect(savedMessage!.imageUrl).toBe(
    "https://example.com/image.jpg"
  );

  senderSocket.disconnect();
  receiverSocket.disconnect();
  });

  it("should reject a text_image message without an image URL", async () => {
  const user1 = await User.create({
    name: "Invalid Text Image Sender",
    email: "invalid-text-image-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Invalid Text Image Receiver",
    email: "invalid-text-image-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const socket = Client(`http://localhost:${port}`, {
    auth: { token },
  });

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
  });

  const callbackResponse = await new Promise<any>((resolve) => {
    socket.emit(
      "send_message",
      {
        conversationId: conversation._id.toString(),
        text: "Hello",
        messageType: "text_image",
      },
      resolve
    );
  });

  expect(callbackResponse.success).toBe(false);
  expect(callbackResponse.error).toBeTypeOf("string");

  const messageCount = await Message.countDocuments({
    conversationId: conversation._id,
  });

  expect(messageCount).toBe(0);

  socket.disconnect();
  });

  it("should reject a message exceeding 2000 characters", async () => {
  const user1 = await User.create({
    name: "Long Message Sender",
    email: "long-message-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Long Message Receiver",
    email: "long-message-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const socket = Client(`http://localhost:${port}`, {
    auth: { token },
  });

  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
  });

  const longText = "a".repeat(2001);

  const callbackResponse = await new Promise<any>((resolve) => {
    socket.emit(
      "send_message",
      {
        conversationId: conversation._id.toString(),
        text: longText,
        messageType: "text",
      },
      resolve
    );
  });

  expect(callbackResponse.success).toBe(false);
  expect(callbackResponse.error).toBeTypeOf("string");

  const messageCount = await Message.countDocuments({
    conversationId: conversation._id,
  });

  expect(messageCount).toBe(0);

  socket.disconnect();
  });

  it("should broadcast typing_start to other conversation participants", async () => {
  const user1 = await User.create({
    name: "Typing User One",
    email: "typing-user-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Typing User Two",
    email: "typing-user-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const senderToken = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const receiverToken = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const senderSocket = Client(`http://localhost:${port}`, {
    auth: { token: senderToken },
  });

  const receiverSocket = Client(`http://localhost:${port}`, {
    auth: { token: receiverToken },
  });

  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        senderSocket.on("connect", resolve);
        senderSocket.on("connect_error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        receiverSocket.on("connect", resolve);
        receiverSocket.on("connect_error", reject);
      }),
    ]);

    const conversationId = conversation._id.toString();

    senderSocket.emit("join_conversation", {
      conversationId,
    });

    const connectedSocket = io.sockets.sockets.get(senderSocket.id!);

    expect(connectedSocket).toBeDefined();

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();

      const checkRoom = () => {
        if (connectedSocket!.rooms.has(conversationId)) {
          resolve();
          return;
        }

        if (Date.now() - start > 3000) {
          reject(new Error("Sender did not join conversation room"));
          return;
        }

        setTimeout(checkRoom, 50);
      };

      checkRoom();
    });

    receiverSocket.emit("join_conversation", {
  conversationId,
});

const connectedReceiverSocket = io.sockets.sockets.get(receiverSocket.id!);

expect(connectedReceiverSocket).toBeDefined();

await new Promise<void>((resolve, reject) => {
  const start = Date.now();

  const checkRoom = () => {
    if (connectedReceiverSocket!.rooms.has(conversationId)) {
      resolve();
      return;
    }

    if (Date.now() - start > 3000) {
      reject(new Error("Receiver did not join conversation room"));
      return;
    }

    setTimeout(checkRoom, 50);
  };

  checkRoom();
});

    const typingPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for typing_start"));
      }, 3000);

      receiverSocket.once("typing_start", (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    senderSocket.emit("typing_start", {
      conversationId,
    });

    const typingData = await typingPromise;

    expect(typingData.conversationId).toBe(conversationId);
    expect(typingData.userId).toBe(user1._id.toString());
  } finally {
    senderSocket.disconnect();
    receiverSocket.disconnect();
  }
  });

  it("should not broadcast typing_start when sender has not joined the conversation room", async () => {
  const user1 = await User.create({
    name: "Typing Sender",
    email: "typing-no-room-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Typing Receiver",
    email: "typing-no-room-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const senderToken = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const receiverToken = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const senderSocket = Client(`http://localhost:${port}`, {
    auth: { token: senderToken },
  });

  const receiverSocket = Client(`http://localhost:${port}`, {
    auth: { token: receiverToken },
  });

  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        senderSocket.on("connect", resolve);
        senderSocket.on("connect_error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        receiverSocket.on("connect", resolve);
        receiverSocket.on("connect_error", reject);
      }),
    ]);

    const conversationId = conversation._id.toString();

    // Receiver joins the room.
    receiverSocket.emit("join_conversation", {
      conversationId,
    });

    const receiverServerSocket = io.sockets.sockets.get(receiverSocket.id!);

    expect(receiverServerSocket).toBeDefined();

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();

      const checkRoom = () => {
        if (receiverServerSocket!.rooms.has(conversationId)) {
          resolve();
          return;
        }

        if (Date.now() - start > 3000) {
          reject(new Error("Receiver did not join conversation room"));
          return;
        }

        setTimeout(checkRoom, 50);
      };

      checkRoom();
    });

    let typingReceived = false;

    receiverSocket.once("typing_start", () => {
      typingReceived = true;
    });

    // Sender has NOT joined the room.
    senderSocket.emit("typing_start", {
      conversationId,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(typingReceived).toBe(false);
  } finally {
    senderSocket.disconnect();
    receiverSocket.disconnect();
  }
  });

  it("should broadcast typing_stop to other conversation participants", async () => {
  const user1 = await User.create({
    name: "Typing Stop Sender",
    email: "typing-stop-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Typing Stop Receiver",
    email: "typing-stop-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const senderToken = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const receiverToken = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const senderSocket = Client(`http://localhost:${port}`, {
    auth: { token: senderToken },
  });

  const receiverSocket = Client(`http://localhost:${port}`, {
    auth: { token: receiverToken },
  });

  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        senderSocket.on("connect", resolve);
        senderSocket.on("connect_error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        receiverSocket.on("connect", resolve);
        receiverSocket.on("connect_error", reject);
      }),
    ]);

    const conversationId = conversation._id.toString();

    senderSocket.emit("join_conversation", { conversationId });
    receiverSocket.emit("join_conversation", { conversationId });

    const senderServerSocket = io.sockets.sockets.get(senderSocket.id!);
    const receiverServerSocket = io.sockets.sockets.get(receiverSocket.id!);

    expect(senderServerSocket).toBeDefined();
    expect(receiverServerSocket).toBeDefined();

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();

      const checkRooms = () => {
        const senderJoined =
          senderServerSocket!.rooms.has(conversationId);

        const receiverJoined =
          receiverServerSocket!.rooms.has(conversationId);

        if (senderJoined && receiverJoined) {
          resolve();
          return;
        }

        if (Date.now() - start > 3000) {
          reject(new Error("Sockets did not join conversation room"));
          return;
        }

        setTimeout(checkRooms, 50);
      };

      checkRooms();
    });

    const received = new Promise<any>((resolve) => {
      receiverSocket.once("typing_stop", resolve);
    });

    senderSocket.emit("typing_stop", {
      conversationId,
    });

    const data = await received;

    expect(data.conversationId).toBe(conversationId);
    expect(data.userId).toBe(user1._id.toString());
  } finally {
    senderSocket.disconnect();
    receiverSocket.disconnect();
  }
  });

  it("should mark messages as read and notify other conversation participants", async () => {
  const user1 = await User.create({
    name: "Read Sender",
    email: "read-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Read Receiver",
    email: "read-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: user1._id,
    text: "Message to read",
    messageType: "text",
  });

  const user1Token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const user2Token = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const socket1 = Client(`http://localhost:${port}`, {
    auth: { token: user1Token },
  });

  const socket2 = Client(`http://localhost:${port}`, {
    auth: { token: user2Token },
  });

  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        socket1.on("connect", resolve);
        socket1.on("connect_error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        socket2.on("connect", resolve);
        socket2.on("connect_error", reject);
      }),
    ]);

    const conversationId = conversation._id.toString();

    socket1.emit("join_conversation", { conversationId });
    socket2.emit("join_conversation", { conversationId });

    const serverSocket1 = io.sockets.sockets.get(socket1.id!);
    const serverSocket2 = io.sockets.sockets.get(socket2.id!);

    expect(serverSocket1).toBeDefined();
    expect(serverSocket2).toBeDefined();

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();

      const checkRooms = () => {
        const user1Joined = serverSocket1!.rooms.has(conversationId);
        const user2Joined = serverSocket2!.rooms.has(conversationId);

        if (user1Joined && user2Joined) {
          resolve();
          return;
        }

        if (Date.now() - start > 3000) {
          reject(new Error("Sockets did not join conversation room"));
          return;
        }

        setTimeout(checkRooms, 50);
      };

      checkRooms();
    });

    const readEvent = new Promise<any>((resolve) => {
      socket1.once("message_read", resolve);
    });

    socket2.emit("message_read", {
      conversationId,
    });

    const eventData = await readEvent;

    expect(eventData.conversationId).toBe(conversationId);
    expect(eventData.readByUserId).toBe(user2._id.toString());

    const updatedMessage = await Message.findById(message._id);

    expect(updatedMessage).not.toBeNull();
    expect(
      updatedMessage!.readBy.some(
        (receipt) => receipt.userId.toString() === user2._id.toString()
      )
    ).toBe(true);
  } finally {
    socket1.disconnect();
    socket2.disconnect();
  }
  });

  it("should not mark messages as read when socket has not joined the conversation room", async () => {
  const user1 = await User.create({
    name: "Read Sender",
    email: "read-no-room-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Read Receiver",
    email: "read-no-room-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: user1._id,
    text: "Unread message",
    messageType: "text",
  });

  const user1Token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const user2Token = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const socket1 = Client(`http://localhost:${port}`, {
    auth: { token: user1Token },
  });

  const socket2 = Client(`http://localhost:${port}`, {
    auth: { token: user2Token },
  });

  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        socket1.on("connect", resolve);
        socket1.on("connect_error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        socket2.on("connect", resolve);
        socket2.on("connect_error", reject);
      }),
    ]);

    const conversationId = conversation._id.toString();

    // Sender joins, receiver intentionally does not.
    socket1.emit("join_conversation", { conversationId });

    const serverSocket1 = io.sockets.sockets.get(socket1.id!);

    expect(serverSocket1).toBeDefined();

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();

      const checkRoom = () => {
        if (serverSocket1!.rooms.has(conversationId)) {
          resolve();
          return;
        }

        if (Date.now() - start > 3000) {
          reject(new Error("Sender did not join conversation room"));
          return;
        }

        setTimeout(checkRoom, 50);
      };

      checkRoom();
    });

    let receivedReadEvent = false;

    socket1.once("message_read", () => {
      receivedReadEvent = true;
    });

    // Receiver has not joined the room.
    socket2.emit("message_read", {
      conversationId,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    const updatedMessage = await Message.findById(message._id);

    expect(updatedMessage).not.toBeNull();
    expect(
      updatedMessage!.readBy.some(
        (receipt) => receipt.userId.toString() === user2._id.toString()
      )
    ).toBe(false);

    expect(receivedReadEvent).toBe(false);
  } finally {
    socket1.disconnect();
    socket2.disconnect();
  }
  });

  it("should not broadcast message_read when there are no unread messages", async () => {
  const user1 = await User.create({
    name: "Read Sender",
    email: "read-already-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Read Receiver",
    email: "read-already-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  await Message.create({
    conversationId: conversation._id,
    senderId: user1._id,
    text: "Already read",
    messageType: "text",
    readBy: [
      {
        userId: user2._id,
        readAt: new Date(),
      },
    ],
  });

  const user1Token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const user2Token = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const socket1 = Client(`http://localhost:${port}`, {
    auth: { token: user1Token },
  });

  const socket2 = Client(`http://localhost:${port}`, {
    auth: { token: user2Token },
  });

  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        socket1.on("connect", resolve);
        socket1.on("connect_error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        socket2.on("connect", resolve);
        socket2.on("connect_error", reject);
      }),
    ]);

    const conversationId = conversation._id.toString();

    socket1.emit("join_conversation", { conversationId });
    socket2.emit("join_conversation", { conversationId });

    const serverSocket1 = io.sockets.sockets.get(socket1.id!);
    const serverSocket2 = io.sockets.sockets.get(socket2.id!);

    expect(serverSocket1).toBeDefined();
    expect(serverSocket2).toBeDefined();

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();

      const checkRooms = () => {
        if (
          serverSocket1!.rooms.has(conversationId) &&
          serverSocket2!.rooms.has(conversationId)
        ) {
          resolve();
          return;
        }

        if (Date.now() - start > 3000) {
          reject(new Error("Sockets did not join conversation room"));
          return;
        }

        setTimeout(checkRooms, 50);
      };

      checkRooms();
    });

    let receivedReadEvent = false;

    socket1.once("message_read", () => {
      receivedReadEvent = true;
    });

    socket2.emit("message_read", {
      conversationId,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(receivedReadEvent).toBe(false);

    const message = await Message.findOne({
      conversationId: conversation._id,
    });

    expect(message).not.toBeNull();
    expect(
      message!.readBy.some(
        (receipt) => receipt.userId.toString() === user2._id.toString()
      )
    ).toBe(true);
  } finally {
    socket1.disconnect();
    socket2.disconnect();
  }
  });

  it("should broadcast user_online when a user connects for the first time", async () => {
  const user1 = await User.create({
    name: "Online Observer",
    email: "online-observer@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Online User",
    email: "online-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user1Token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const user2Token = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const socket1 = Client(`http://localhost:${port}`, {
    auth: { token: user1Token },
  });

  const socket2 = Client(`http://localhost:${port}`, {
    auth: { token: user2Token },
    autoConnect: false,
  });

  try {
    await new Promise<void>((resolve, reject) => {
      socket1.on("connect", resolve);
      socket1.on("connect_error", reject);
    });

    const onlineEvent = new Promise<any>((resolve) => {
      socket1.once("user_online", resolve);
    });

    socket2.connect();

    await new Promise<void>((resolve, reject) => {
      socket2.on("connect", resolve);
      socket2.on("connect_error", reject);
    });

    const data = await onlineEvent;

    expect(data.userId).toBe(user2._id.toString());
  } finally {
    socket1.disconnect();
    socket2.disconnect();
  }
  });

  it("should broadcast user_offline when a user disconnects completely", async () => {
  const user1 = await User.create({
    name: "Offline Observer",
    email: "offline-observer@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Offline User",
    email: "offline-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user1Token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const user2Token = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const socket1 = Client(`http://localhost:${port}`, {
    auth: { token: user1Token },
  });

  const socket2 = Client(`http://localhost:${port}`, {
    auth: { token: user2Token },
  });

  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        socket1.on("connect", resolve);
        socket1.on("connect_error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        socket2.on("connect", resolve);
        socket2.on("connect_error", reject);
      }),
    ]);

    const offlineEvent = new Promise<any>((resolve) => {
      socket1.once("user_offline", resolve);
    });

    socket2.disconnect();

    const data = await offlineEvent;

    expect(data.userId).toBe(user2._id.toString());
  } finally {
    socket1.disconnect();
    socket2.disconnect();
  }
  });

  it("should not broadcast user_offline while another socket of the same user remains connected", async () => {
  const observer = await User.create({
    name: "Presence Observer",
    email: "presence-observer@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user = await User.create({
    name: "Multi Socket User",
    email: "multi-socket-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const observerToken = generateAccessToken({
    userId: observer._id.toString(),
    role: "user",
  });

  const userToken = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const observerSocket = Client(`http://localhost:${port}`, {
    auth: { token: observerToken },
  });

  const userSocket1 = Client(`http://localhost:${port}`, {
    auth: { token: userToken },
  });

  const userSocket2 = Client(`http://localhost:${port}`, {
    auth: { token: userToken },
  });

  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        observerSocket.on("connect", resolve);
        observerSocket.on("connect_error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        userSocket1.on("connect", resolve);
        userSocket1.on("connect_error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        userSocket2.on("connect", resolve);
        userSocket2.on("connect_error", reject);
      }),
    ]);

    let receivedOfflineEvent = false;

    observerSocket.once("user_offline", () => {
      receivedOfflineEvent = true;
    });

    // One of the user's two sockets disconnects.
    userSocket1.disconnect();

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(receivedOfflineEvent).toBe(false);
    expect(userSocket2.connected).toBe(true);
  } finally {
    observerSocket.disconnect();
    userSocket1.disconnect();
    userSocket2.disconnect();
  }
  });

  it("should not broadcast typing_stop when sender has not joined the conversation room", async () => {
  const user1 = await User.create({
    name: "Typing Stop Sender",
    email: "typing-stop-no-room-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Typing Stop Receiver",
    email: "typing-stop-no-room-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const senderToken = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const receiverToken = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const senderSocket = Client(`http://localhost:${port}`, {
    auth: { token: senderToken },
  });

  const receiverSocket = Client(`http://localhost:${port}`, {
    auth: { token: receiverToken },
  });

  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        senderSocket.on("connect", resolve);
        senderSocket.on("connect_error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        receiverSocket.on("connect", resolve);
        receiverSocket.on("connect_error", reject);
      }),
    ]);

    const conversationId = conversation._id.toString();

    receiverSocket.emit("join_conversation", {
      conversationId,
    });

    const receiverServerSocket = io.sockets.sockets.get(receiverSocket.id!);

    expect(receiverServerSocket).toBeDefined();

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();

      const checkRoom = () => {
        if (receiverServerSocket!.rooms.has(conversationId)) {
          resolve();
          return;
        }

        if (Date.now() - start > 3000) {
          reject(new Error("Receiver did not join conversation room"));
          return;
        }

        setTimeout(checkRoom, 50);
      };

      checkRoom();
    });

    let receivedTypingStop = false;

    receiverSocket.once("typing_stop", () => {
      receivedTypingStop = true;
    });

    // Sender intentionally does not join the room.
    senderSocket.emit("typing_stop", {
      conversationId,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(receivedTypingStop).toBe(false);
  } finally {
    senderSocket.disconnect();
    receiverSocket.disconnect();
  }
  });

  it("should allow the other participant to join a conversation hidden by one user", async () => {
  const user1 = await User.create({
    name: "Hidden User",
    email: "hidden-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Visible User",
    email: "visible-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
    deletedBy: [user1._id],
  });

  const user2Token = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const socket = Client(`http://localhost:${port}`, {
    auth: { token: user2Token },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", resolve);
      socket.on("connect_error", reject);
    });

    const conversationId = conversation._id.toString();

    socket.emit("join_conversation", {
      conversationId,
    });

    const serverSocket = io.sockets.sockets.get(socket.id!);

    expect(serverSocket).toBeDefined();

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();

      const checkRoom = () => {
        if (serverSocket!.rooms.has(conversationId)) {
          resolve();
          return;
        }

        if (Date.now() - start > 3000) {
          reject(new Error("User 2 did not join conversation room"));
          return;
        }

        setTimeout(checkRoom, 50);
      };

      checkRoom();
    });

    expect(serverSocket!.rooms.has(conversationId)).toBe(true);
  } finally {
    socket.disconnect();
  }
  });

  it("should reject an invalid message_read payload", async () => {
  const user = await User.create({
    name: "Invalid Read User",
    email: "invalid-read-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const socket = Client(`http://localhost:${port}`, {
    auth: { token },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", resolve);
      socket.on("connect_error", reject);
    });

    socket.emit("message_read", {
      conversationId: "invalid-conversation-id",
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(socket.connected).toBe(true);
  } finally {
    socket.disconnect();
  }
  });

  it("should not allow a non-participant to mark messages as read", async () => {
  const user1 = await User.create({
    name: "Conversation User",
    email: "read-auth-user1@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Conversation User 2",
    email: "read-auth-user2@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user3 = await User.create({
    name: "Unauthorized Reader",
    email: "read-auth-user3@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: user1._id,
    text: "Private message",
    messageType: "text",
  });

  const token = generateAccessToken({
    userId: user3._id.toString(),
    role: "user",
  });

  const socket = Client(`http://localhost:${port}`, {
    auth: { token },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", resolve);
      socket.on("connect_error", reject);
    });

    const conversationId = conversation._id.toString();

    // Non-participant cannot join the conversation room.
    socket.emit("join_conversation", {
      conversationId,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    socket.emit("message_read", {
      conversationId,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    const updatedMessage = await Message.findById(message._id);

    expect(updatedMessage).not.toBeNull();

    expect(
      updatedMessage!.readBy.some(
        (receipt) => receipt.userId.toString() === user3._id.toString()
      )
    ).toBe(false);

    expect(socket.connected).toBe(true);
  } finally {
    socket.disconnect();
  }
  });
});