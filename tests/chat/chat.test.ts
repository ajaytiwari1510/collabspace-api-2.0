import mongoose from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { User } from "../../src/models/user.model.js";
import { Conversation } from "../../src/models/conversation.model.js";
import { Message } from "../../src/models/message.model.js";
import { generateAccessToken } from "../../src/utils/jwt.util.js";

describe("Chat REST", () => {
  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  it("should create a conversation between two users", async () => {
  const userA = await User.create({
    name: "Chat User A",
    email: "chat-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Chat User B",
    email: "chat-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(response.status).toBe(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data).toBeDefined();

  expect(response.body.data.participants).toHaveLength(2);
  });

  it("should not allow unauthenticated users to create a conversation", async () => {
  const userA = await User.create({
    name: "Unauthenticated User",
    email: "chat-unauth-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Chat User B",
    email: "chat-unauth-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const response = await request(app)
    .post("/api/conversations")
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(response.status).toBe(401);
  });

  it("should not allow a user to create a conversation with themselves", async () => {
  const user = await User.create({
    name: "Self Chat User",
    email: "self-chat@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: user._id.toString(),
    });

  expect(response.status).toBe(400);
  });

  it("should not allow creating a conversation with a non-existent user", async () => {
  const user = await User.create({
    name: "Existing Chat User",
    email: "existing-chat@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const nonExistentUserId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: nonExistentUserId.toString(),
    });

  expect(response.status).toBe(404);
  });

  it("should reject an invalid user ID when creating a conversation", async () => {
  const user = await User.create({
    name: "Invalid ID User",
    email: "invalid-chat-id@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: "not-a-valid-object-id",
    });

  expect(response.status).toBe(400);
  });

  it("should return the existing conversation instead of creating a duplicate", async () => {
  const userA = await User.create({
    name: "Duplicate Chat A",
    email: "duplicate-chat-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Duplicate Chat B",
    email: "duplicate-chat-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const firstResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(firstResponse.status).toBe(200);

  const secondResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(secondResponse.status).toBe(200);

  expect(secondResponse.body.data._id).toBe(
    firstResponse.body.data._id,
  );

  const conversationCount = await Conversation.countDocuments();

  expect(conversationCount).toBe(1);
  });

  it("should not allow a non-participant to access conversation messages", async () => {
  const userA = await User.create({
    name: "Chat Participant A",
    email: "chat-participant-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Chat Participant B",
    email: "chat-participant-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userC = await User.create({
    name: "Chat Non Participant",
    email: "chat-non-participant@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const participantToken = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${participantToken}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  const nonParticipantToken = generateAccessToken({
    userId: userC._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set("Authorization", `Bearer ${nonParticipantToken}`);

  expect(response.status).toBe(403);
  });

  it("should not allow unauthenticated users to access conversation messages", async () => {
  const userA = await User.create({
    name: "Chat Auth User A",
    email: "chat-auth-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Chat Auth User B",
    email: "chat-auth-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  const response = await request(app).get(
    `/api/conversations/${conversationId}/messages`,
  );

  expect(response.status).toBe(401);
  });

  it("should allow a conversation participant to access message history", async () => {
  const userA = await User.create({
    name: "History User A",
    email: "history-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "History User B",
    email: "history-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  const tokenB = generateAccessToken({
    userId: userB._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set("Authorization", `Bearer ${tokenB}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data).toBeDefined();
  });

  it("should return 404 when accessing a non-existent conversation", async () => {
  const user = await User.create({
    name: "Missing Conversation User",
    email: "missing-conversation@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const conversationId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(404);
  });

  it("should reject an invalid conversation ID", async () => {
  const user = await User.create({
    name: "Invalid Conversation User",
    email: "invalid-conversation@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations/not-a-valid-id/messages")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(400);
  });

  it("should return messages from a conversation", async () => {
  const userA = await User.create({
    name: "Message History A",
    email: "message-history-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Message History B",
    email: "message-history-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

await Message.create({
  conversationId,
  senderId: userA._id,
  text: "Hello from User A",
  messageType: "text",
});

await Message.create({
  conversationId,
  senderId: userB._id,
  text: "Hello from User B",
  messageType: "text",
});

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set("Authorization", `Bearer ${tokenA}`);

  expect(response.status).toBe(200);

  expect(response.body.data.messages).toHaveLength(2);

  expect(
    response.body.data.messages.map(
      (message: { text: string }) => message.text,
    ),
  ).toEqual(
    expect.arrayContaining([
      "Hello from User A",
      "Hello from User B",
    ]),
  );
  });

  it("should return only conversations belonging to the authenticated user", async () => {
  const userA = await User.create({
    name: "Conversation List A",
    email: "conversation-list-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Conversation List B",
    email: "conversation-list-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userC = await User.create({
    name: "Conversation List C",
    email: "conversation-list-c@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userD = await User.create({
    name: "Conversation List D",
    email: "conversation-list-d@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const tokenD = generateAccessToken({
    userId: userD._id.toString(),
    role: "user",
  });

  // User A creates conversations with B and C.
  const conversationAB = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(conversationAB.status).toBe(200);

  const conversationAC = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userC._id.toString(),
    });

  expect(conversationAC.status).toBe(200);

  // User D creates a separate conversation with B.
  const conversationDB = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenD}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(conversationDB.status).toBe(200);

  const response = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`);

expect(response.status).toBe(200);

const conversations = response.body.data.conversations;

expect(conversations).toHaveLength(2);

const conversationIds = conversations.map(
  (conversation: { _id: string }) => conversation._id,
);

expect(conversationIds).toContain(conversationAB.body.data._id);
expect(conversationIds).toContain(conversationAC.body.data._id);
expect(conversationIds).not.toContain(conversationDB.body.data._id);
  });

  it("should not allow unauthenticated users to get conversations", async () => {
  const response = await request(app)
    .get("/api/conversations");

  expect(response.status).toBe(401);
  });

  it("should paginate conversations correctly", async () => {
  const userA = await User.create({
    name: "Pagination A",
    email: "pagination-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const otherUsers = await User.insertMany(
    Array.from({ length: 12 }, (_, index) => ({
      name: `Pagination User ${index}`,
      email: `pagination-user-${index}@test.com`,
      passwordHash: "hashed-password",
      authMethod: "email",
    })),
  );

  await Conversation.insertMany(
  otherUsers.map((user) => ({
    participants: [userA._id, user._id],
    createdBy: userA._id,
    isGroup: false,
    deletedBy: [],
  })),
  );

  const pageOne = await request(app)
    .get("/api/conversations?page=1&limit=10")
    .set("Authorization", `Bearer ${tokenA}`);

  expect(pageOne.status).toBe(200);
  expect(pageOne.body.data.conversations).toHaveLength(10);
  expect(pageOne.body.data.pagination).toEqual({
    page: 1,
    limit: 10,
    total: 12,
    hasMore: true,
  });

  const pageTwo = await request(app)
    .get("/api/conversations?page=2&limit=10")
    .set("Authorization", `Bearer ${tokenA}`);

  expect(pageTwo.status).toBe(200);
  expect(pageTwo.body.data.conversations).toHaveLength(2);
  expect(pageTwo.body.data.pagination).toEqual({
    page: 2,
    limit: 10,
    total: 12,
    hasMore: false,
  });
  });

  it("should handle invalid pagination parameters with default values", async () => {
  const user = await User.create({
    name: "Invalid Pagination",
    email: "invalid-pagination@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations?page=abc&limit=10")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.pagination).toEqual({
    page: 1,
    limit: 10,
    total: 0,
    hasMore: false,
  });
  });

  it("should cap an excessively large conversation limit", async () => {
  const user = await User.create({
    name: "Large Limit",
    email: "large-limit@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations?limit=1000")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.pagination.limit).toBeLessThan(1000);
  });

  it("should handle a negative conversation page with default values", async () => {
  const user = await User.create({
    name: "Negative Page",
    email: "negative-page@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations?page=-1&limit=10")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.pagination.page).toBe(1);
  expect(response.body.data.pagination.limit).toBe(10);
  });

  it("should return conversation messages in chronological order", async () => {
  const userA = await User.create({
    name: "Message Order A",
    email: "message-order-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Message Order B",
    email: "message-order-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  const firstMessage = await Message.create({
    conversationId,
    senderId: userA._id,
    text: "First message",
    messageType: "text",
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
  });

  const secondMessage = await Message.create({
    conversationId,
    senderId: userB._id,
    text: "Second message",
    messageType: "text",
    createdAt: new Date("2026-01-01T10:01:00.000Z"),
  });

  const thirdMessage = await Message.create({
    conversationId,
    senderId: userA._id,
    text: "Third message",
    messageType: "text",
    createdAt: new Date("2026-01-01T10:02:00.000Z"),
  });

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set("Authorization", `Bearer ${tokenA}`);

  expect(response.status).toBe(200);

  const messages = response.body.data.messages;

  expect(messages).toHaveLength(3);

  expect(
    messages.map((message: { _id: string }) => message._id),
  ).toEqual([
    firstMessage._id.toString(),
    secondMessage._id.toString(),
    thirdMessage._id.toString(),
  ]);
  });

  it("should not return deleted messages", async () => {
  const userA = await User.create({
    name: "Deleted Message A",
    email: "deleted-message-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Deleted Message B",
    email: "deleted-message-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  const activeMessage = await Message.create({
    conversationId,
    senderId: userA._id,
    text: "Active message",
    messageType: "text",
  });

  const deletedMessage = await Message.create({
    conversationId,
    senderId: userB._id,
    text: "Deleted message",
    messageType: "text",
    isDeleted: true,
  });

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set("Authorization", `Bearer ${tokenA}`);

  expect(response.status).toBe(200);

  const messages = response.body.data.messages;

  expect(messages).toHaveLength(1);

  expect(messages[0]._id).toBe(activeMessage._id.toString());

  expect(messages[0]._id).not.toBe(deletedMessage._id.toString());
  });

  it("should paginate conversation messages correctly", async () => {
  const userA = await User.create({
    name: "Message Pagination A",
    email: "message-pagination-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Message Pagination B",
    email: "message-pagination-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  await Message.insertMany(
    Array.from({ length: 12 }, (_, index) => ({
      conversationId,
      senderId: index % 2 === 0 ? userA._id : userB._id,
      text: `Message ${index + 1}`,
      messageType: "text",
      createdAt: new Date(
        `2026-01-01T10:${String(index).padStart(2, "0")}:00.000Z`,
      ),
    })),
  );

  const pageOne = await request(app)
    .get(`/api/conversations/${conversationId}/messages?page=1&limit=10`)
    .set("Authorization", `Bearer ${tokenA}`);

  expect(pageOne.status).toBe(200);
  expect(pageOne.body.data.messages).toHaveLength(10);

  expect(pageOne.body.data.pagination).toEqual({
    page: 1,
    limit: 10,
    total: 12,
    hasMore: true,
  });

  const pageTwo = await request(app)
    .get(`/api/conversations/${conversationId}/messages?page=2&limit=10`)
    .set("Authorization", `Bearer ${tokenA}`);

  expect(pageTwo.status).toBe(200);
  expect(pageTwo.body.data.messages).toHaveLength(2);

  expect(pageTwo.body.data.pagination).toEqual({
    page: 2,
    limit: 10,
    total: 12,
    hasMore: false,
  });
  });

  it("should not allow unauthenticated users to access message history", async () => {
  const userA = await User.create({
    name: "Unauthenticated Message A",
    email: "unauth-message-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Unauthenticated Message B",
    email: "unauth-message-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`);

  expect(response.status).toBe(401);
  });

  it("should allow a conversation participant to access message history", async () => {
  const userA = await User.create({
    name: "Participant Message A",
    email: "participant-message-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Participant Message B",
    email: "participant-message-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set("Authorization", `Bearer ${tokenA}`);

  expect(response.status).toBe(200);
  });

  it("should allow the other conversation participant to access message history", async () => {
  const userA = await User.create({
    name: "Other Participant A",
    email: "other-participant-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Other Participant B",
    email: "other-participant-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const tokenB = generateAccessToken({
    userId: userB._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set("Authorization", `Bearer ${tokenB}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data).toBeDefined();
  });

  it("should not return conversations where the authenticated user is not a participant", async () => {
  const userA = await User.create({
    name: "Isolated List A",
    email: "isolated-list-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Isolated List B",
    email: "isolated-list-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userC = await User.create({
    name: "Isolated List C",
    email: "isolated-list-c@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const tokenB = generateAccessToken({
    userId: userB._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({
      otherUserId: userC._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  const response = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`);

  expect(response.status).toBe(200);

  const conversations = response.body.data.conversations;

  expect(conversations).toHaveLength(0);

  const conversationIds = conversations.map(
    (conversation: { _id: string }) => conversation._id,
  );

  expect(conversationIds).not.toContain(conversationId);
  });

  it("should handle invalid message pagination parameters with default values", async () => {
  const userA = await User.create({
    name: "Invalid Message Pagination A",
    email: "invalid-message-pagination-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Invalid Message Pagination B",
    email: "invalid-message-pagination-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages?page=abc&limit=10`)
    .set("Authorization", `Bearer ${tokenA}`);

  expect(response.status).toBe(200);

  expect(response.body.data.pagination.page).toBe(1);
  expect(response.body.data.pagination.limit).toBe(10);
  });

  it("should cap an excessively large message limit", async () => {
  const userA = await User.create({
    name: "Large Message Limit A",
    email: "large-message-limit-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Large Message Limit B",
    email: "large-message-limit-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages?limit=1000`)
    .set("Authorization", `Bearer ${tokenA}`);

  expect(response.status).toBe(200);

  expect(response.body.data.pagination.limit).toBeLessThan(1000);
  });

  it("should handle a negative message page with default values", async () => {
  const userA = await User.create({
    name: "Negative Message Page A",
    email: "negative-message-page-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Negative Message Page B",
    email: "negative-message-page-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages?page=-1&limit=10`)
    .set("Authorization", `Bearer ${tokenA}`);

  expect(response.status).toBe(200);

  expect(response.body.data.pagination.page).toBe(1);
  expect(response.body.data.pagination.limit).toBe(10);
  });

  it("should return an empty message list for a conversation with no messages", async () => {
  const userA = await User.create({
    name: "Empty History A",
    email: "empty-history-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Empty History B",
    email: "empty-history-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set("Authorization", `Bearer ${tokenA}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data.messages).toEqual([]);
  expect(response.body.data.pagination.total).toBe(0);
  expect(response.body.data.pagination.hasMore).toBe(false);
  });

  it("should return an empty message list when all messages are deleted", async () => {
  const userA = await User.create({
    name: "All Deleted A",
    email: "all-deleted-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "All Deleted B",
    email: "all-deleted-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  await Message.insertMany([
    {
      conversationId,
      senderId: userA._id,
      text: "Deleted message 1",
      messageType: "text",
      isDeleted: true,
    },
    {
      conversationId,
      senderId: userB._id,
      text: "Deleted message 2",
      messageType: "text",
      isDeleted: true,
    },
  ]);

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set("Authorization", `Bearer ${tokenA}`);

  expect(response.status).toBe(200);
  expect(response.body.data.messages).toEqual([]);
  expect(response.body.data.pagination.total).toBe(0);
  expect(response.body.data.pagination.hasMore).toBe(false);
  });

  it("should return an empty message list when requesting a page beyond available messages", async () => {
  const userA = await User.create({
    name: "Beyond Page A",
    email: "beyond-page-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Beyond Page B",
    email: "beyond-page-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      otherUserId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(200);

  const conversationId = createResponse.body.data._id;

  await Message.insertMany([
    {
      conversationId,
      senderId: userA._id,
      text: "Message 1",
      messageType: "text",
    },
    {
      conversationId,
      senderId: userB._id,
      text: "Message 2",
      messageType: "text",
    },
  ]);

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages?page=2&limit=10`)
    .set("Authorization", `Bearer ${tokenA}`);

  expect(response.status).toBe(200);
  expect(response.body.data.messages).toEqual([]);

  expect(response.body.data.pagination).toEqual({
    page: 2,
    limit: 10,
    total: 2,
    hasMore: false,
  });
  });

  it("should return an empty conversation list when the user has no conversations", async () => {
  const user = await User.create({
    name: "No Conversations User",
    email: "no-conversations@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  expect(response.body.data.conversations).toEqual([]);

  expect(response.body.data.pagination).toEqual({
    page: 1,
    limit: 10,
    total: 0,
    hasMore: false,
  });
  });

  it("should return an empty conversation list when requesting a page beyond available conversations", async () => {
  const user1 = await User.create({
    name: "Conversation User",
    email: "conversation-page@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Other User",
    email: "other-page@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Conversation.create({
  participants: [user1._id, user2._id],
  createdBy: user1._id,
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations?page=2&limit=10")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  expect(response.body.data.conversations).toEqual([]);

  expect(response.body.data.pagination).toEqual({
    page: 2,
    limit: 10,
    total: 1,
    hasMore: false,
  });
  });

  it("should return conversations with the most recently updated first", async () => {
  const user1 = await User.create({
    name: "Ordering User",
    email: "ordering-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Ordering User Two",
    email: "ordering-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user3 = await User.create({
    name: "Ordering User Three",
    email: "ordering-three@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const olderConversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const newerConversation = await Conversation.create({
    participants: [user1._id, user3._id],
    createdBy: user1._id,
  });

  await Conversation.updateOne(
    { _id: olderConversation._id },
    {
      $set: {
        updatedAt: new Date(Date.now() - 60_000),
      },
    }
  );

  await Conversation.updateOne(
    { _id: newerConversation._id },
    {
      $set: {
        updatedAt: new Date(),
      },
    }
  );

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  expect(response.body.data.conversations).toHaveLength(2);

  expect(response.body.data.conversations[0]._id).toBe(
    newerConversation._id.toString()
  );

  expect(response.body.data.conversations[1]._id).toBe(
    olderConversation._id.toString()
  );
  });

  it("should not return conversations hidden by the authenticated user", async () => {
  const user1 = await User.create({
    name: "Hidden Conversation User",
    email: "hidden-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Visible Conversation User",
    email: "visible-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user3 = await User.create({
    name: "Another Conversation User",
    email: "another-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
    deletedBy: [user1._id],
  });

  const visibleConversation = await Conversation.create({
    participants: [user1._id, user3._id],
    createdBy: user1._id,
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  expect(response.body.data.conversations).toHaveLength(1);

  expect(response.body.data.conversations[0]._id).toBe(
    visibleConversation._id.toString()
  );
  });

  it("should still return a conversation to the other participant when only one user hides it", async () => {
  const user1 = await User.create({
    name: "Hidden User",
    email: "hidden-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Other Participant",
    email: "hidden-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
    deletedBy: [user1._id],
  });

  const token = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  expect(response.body.data.conversations).toHaveLength(1);

  expect(response.body.data.conversations[0]._id).toBe(
    conversation._id.toString()
  );
  });

  it("should not expose deletedBy in the conversation response", async () => {
  const user1 = await User.create({
    name: "Private Data User",
    email: "private-data-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Private Data User Two",
    email: "private-data-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
    deletedBy: [user2._id],
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  expect(response.body.data.conversations).toHaveLength(1);

  expect(response.body.data.conversations[0]).not.toHaveProperty(
    "deletedBy"
  );
  });

  it("should return participant names in the conversation response", async () => {
  const user1 = await User.create({
    name: "Participant One",
    email: "participant-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Participant Two",
    email: "participant-two@test.com",
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

  const response = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const returnedConversation = response.body.data.conversations[0];

  expect(returnedConversation._id).toBe(conversation._id.toString());

  expect(returnedConversation.participants).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        _id: user1._id.toString(),
        name: "Participant One",
      }),
      expect.objectContaining({
        _id: user2._id.toString(),
        name: "Participant Two",
      }),
    ])
  );
  });

  it("should return the last message sender name in the conversation response", async () => {
  const user1 = await User.create({
    name: "Message Sender",
    email: "message-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Message Receiver",
    email: "message-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
    lastMessage: {
      senderId: user1._id,
      text: "Hello from sender",
      messageType: "text",
    },
  });

  const token = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const returnedConversation = response.body.data.conversations[0];

  expect(returnedConversation._id).toBe(conversation._id.toString());

  expect(returnedConversation.lastMessage.senderId).toEqual(
    expect.objectContaining({
      _id: user1._id.toString(),
      name: "Message Sender",
    })
  );
  });

  it("should handle conversations without a last message", async () => {
  const user1 = await User.create({
    name: "No Message User",
    email: "no-message-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "No Message User Two",
    email: "no-message-two@test.com",
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

  const response = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const returnedConversation = response.body.data.conversations[0];

  expect(returnedConversation._id).toBe(conversation._id.toString());
  expect(returnedConversation.lastMessage).toBeUndefined();
  });

  it("should not return conversations that do not belong to the authenticated user", async () => {
  const user1 = await User.create({
    name: "Conversation Owner One",
    email: "isolation-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Conversation Owner Two",
    email: "isolation-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user3 = await User.create({
    name: "Outside User",
    email: "isolation-three@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const token = generateAccessToken({
    userId: user3._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  expect(response.body.data.conversations).toEqual([]);

  expect(response.body.data.pagination.total).toBe(0);
  });

  it("should return the existing conversation when participants are provided in reverse order", async () => {
  const user1 = await User.create({
    name: "Reverse User One",
    email: "reverse-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Reverse User Two",
    email: "reverse-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  // User 1 creates the conversation with User 2
  const token1 = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const firstResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token1}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  expect(firstResponse.status).toBe(200);
  expect(firstResponse.body.success).toBe(true);

  const conversationId = firstResponse.body.data._id;

  // User 2 requests a conversation with User 1
  const token2 = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const secondResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token2}`)
    .send({
      otherUserId: user1._id.toString(),
    });

  expect(secondResponse.status).toBe(200);
  expect(secondResponse.body.success).toBe(true);

  expect(secondResponse.body.data._id).toBe(conversationId);

  expect(await Conversation.countDocuments()).toBe(1);
  });

  it("should not allow unauthenticated conversation creation with a missing user ID", async () => {
  const response = await request(app)
    .post("/api/conversations")
    .send({});

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
  });

  it("should reject conversation creation when otherUserId is missing", async () => {
  const user = await User.create({
    name: "Missing Participant User",
    email: "missing-participant@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({});

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  });

  it("should reject an invalid otherUserId when creating a conversation", async () => {
  const user = await User.create({
    name: "Invalid Participant User",
    email: "invalid-participant@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: "invalid-user-id",
    });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  });

  it("should not create a conversation when otherUserId is invalid", async () => {
  const user = await User.create({
    name: "Invalid ID User",
    email: "invalid-id-db@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: "invalid-user-id",
    });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  expect(await Conversation.countDocuments()).toBe(0);
  });

  it("should not create a conversation when otherUserId does not exist", async () => {
  const user = await User.create({
    name: "Missing User Test",
    email: "missing-user-db@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const fakeUserId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: fakeUserId.toString(),
    });

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);

  expect(await Conversation.countDocuments()).toBe(0);
  });

  it("should not create a conversation when user tries to chat with themselves", async () => {
  const user = await User.create({
    name: "Self Chat User",
    email: "self-chat-db@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: user._id.toString(),
    });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  expect(await Conversation.countDocuments()).toBe(0);
  });

  it("should not add duplicate participants when creating an existing conversation", async () => {
  const user1 = await User.create({
    name: "Duplicate Participant One",
    email: "duplicate-participant-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Duplicate Participant Two",
    email: "duplicate-participant-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversation = await Conversation.findOne({
    participants: { $all: [user1._id, user2._id] },
  });

  expect(conversation).not.toBeNull();
  expect(conversation!.participants).toHaveLength(2);
  });

  it("should not create a conversation with an unrelated user", async () => {
  const user1 = await User.create({
    name: "Conversation User One",
    email: "isolation-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Conversation User Two",
    email: "isolation-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user3 = await User.create({
    name: "Unrelated User",
    email: "isolation-three@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  expect(response.status).toBe(200);

  const conversation = await Conversation.findOne({
    participants: { $all: [user1._id, user2._id] },
  });

  expect(conversation).not.toBeNull();
  expect(conversation!.participants).toHaveLength(2);
  expect(
    conversation!.participants.some(
      (participant) => participant.toString() === user3._id.toString()
    )
  ).toBe(false);
  });

  it("should not modify messages when fetching conversation history", async () => {
  const user1 = await User.create({
    name: "History User One",
    email: "history-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "History User Two",
    email: "history-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  const firstMessage = await Message.create({
    conversationId,
    senderId: user1._id,
    text: "First message",
    messageType: "text",
  });

  const secondMessage = await Message.create({
    conversationId,
    senderId: user2._id,
    text: "Second message",
    messageType: "text",
  });

  const before = await Message.find({
    conversationId,
  })
    .sort({ createdAt: 1 })
    .lean();

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  const after = await Message.find({
    conversationId,
  })
    .sort({ createdAt: 1 })
    .lean();

  expect(after).toHaveLength(2);
  expect(after.map((message) => message._id.toString())).toEqual(
    before.map((message) => message._id.toString())
  );

  expect(after.map((message) => message.text)).toEqual(
    before.map((message) => message.text)
  );

  expect(firstMessage._id.toString()).toBe(after[0]._id.toString());
  expect(secondMessage._id.toString()).toBe(after[1]._id.toString());
  });

  it("should not modify messages when paginating conversation history", async () => {
  const user1 = await User.create({
    name: "Pagination User One",
    email: "pagination-db-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Pagination User Two",
    email: "pagination-db-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  await Message.insertMany(
    Array.from({ length: 12 }, (_, index) => ({
      conversationId,
      senderId: index % 2 === 0 ? user1._id : user2._id,
      text: `Message ${index + 1}`,
      messageType: "text",
    }))
  );

  const beforeCount = await Message.countDocuments({ conversationId });

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages?page=2&limit=10`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.messages).toHaveLength(2);

  const afterCount = await Message.countDocuments({ conversationId });

  expect(afterCount).toBe(beforeCount);
  expect(afterCount).toBe(12);
  });

  it("should not allow a non-participant to paginate conversation messages", async () => {
  const user1 = await User.create({
    name: "Participant One",
    email: "pagination-auth-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Participant Two",
    email: "pagination-auth-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const outsider = await User.create({
    name: "Outsider",
    email: "pagination-outsider@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const participantToken = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${participantToken}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  const outsiderToken = generateAccessToken({
    userId: outsider._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages?page=2&limit=10`)
    .set("Authorization", `Bearer ${outsiderToken}`);

  expect(response.status).toBe(403);
  expect(response.body.success).toBe(false);
  });

  it("should not allow unauthenticated users to paginate conversation messages", async () => {
  const user1 = await User.create({
    name: "Unauthenticated User One",
    email: "pagination-unauth-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Unauthenticated User Two",
    email: "pagination-unauth-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  const response = await request(app).get(
    `/api/conversations/${conversationId}/messages?page=2&limit=10`
  );

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
  });

  it("should reject an invalid conversation ID when requesting paginated messages", async () => {
  const user = await User.create({
    name: "Invalid Conversation ID User",
    email: "invalid-conversation-pagination@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations/invalid-conversation-id/messages?page=2&limit=10")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  });

  it("should not modify conversations when fetching the conversation list", async () => {
  const user1 = await User.create({
    name: "List User One",
    email: "list-readonly-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "List User Two",
    email: "list-readonly-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const before = await Conversation.find({}).lean();

  const response = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  const after = await Conversation.find({}).lean();

  expect(after).toHaveLength(before.length);
  expect(after[0]._id.toString()).toBe(before[0]._id.toString());
  expect(after[0].participants.map(String)).toEqual(
    before[0].participants.map(String)
  );
  });

  it("should not modify conversations when paginating the conversation list", async () => {
  const user = await User.create({
    name: "Conversation Pagination User",
    email: "conversation-pagination-db@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const otherUsers = await User.insertMany(
    Array.from({ length: 12 }, (_, index) => ({
      name: `Other User ${index + 1}`,
      email: `other-${index + 1}@test.com`,
      passwordHash: "hashed-password",
      authMethod: "email",
    }))
  );

  await Conversation.insertMany(
    otherUsers.map((otherUser) => ({
      participants: [user._id, otherUser._id],
      createdBy: user._id,
    }))
  );

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const beforeCount = await Conversation.countDocuments();

  const response = await request(app)
    .get("/api/conversations?page=2&limit=10")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.conversations).toHaveLength(2);

  const afterCount = await Conversation.countDocuments();

  expect(afterCount).toBe(beforeCount);
  expect(afterCount).toBe(12);
  });

  it("should not return hidden conversations when paginating", async () => {
  const user = await User.create({
    name: "Hidden Pagination User",
    email: "hidden-pagination@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const otherUsers = await User.insertMany(
    Array.from({ length: 12 }, (_, index) => ({
      name: `Hidden Test User ${index + 1}`,
      email: `hidden-${index + 1}@test.com`,
      passwordHash: "hashed-password",
      authMethod: "email",
    }))
  );

  const conversations = await Conversation.insertMany(
    otherUsers.map((otherUser) => ({
      participants: [user._id, otherUser._id],
      createdBy: user._id,
    }))
  );

  conversations[0].deletedBy = [user._id];
  await conversations[0].save();

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations?page=1&limit=10")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  const returnedIds = response.body.data.conversations.map(
    (conversation: { _id: string }) => conversation._id
  );

  expect(returnedIds).not.toContain(conversations[0]._id.toString());
  expect(response.body.data.pagination.total).toBe(11);
  });

  it("should allow the other participant to access messages when one user hides the conversation", async () => {
  const user1 = await User.create({
    name: "Hidden Message User One",
    email: "hidden-message-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Hidden Message User Two",
    email: "hidden-message-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token1 = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token1}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  await Message.create({
    conversationId,
    senderId: user1._id,
    text: "Message remains available",
    messageType: "text",
  });

  const conversation = await Conversation.findById(conversationId);

  conversation!.deletedBy = [user1._id];
  await conversation!.save();

  const token2 = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set("Authorization", `Bearer ${token2}`);

  expect(response.status).toBe(200);
  expect(response.body.data.messages).toHaveLength(1);
  expect(response.body.data.messages[0].text).toBe(
    "Message remains available"
  );
  });

  it("should allow a user to access messages after hiding the conversation", async () => {
  const user1 = await User.create({
    name: "Hidden Owner One",
    email: "hidden-owner-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Hidden Owner Two",
    email: "hidden-owner-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  await Message.create({
    conversationId,
    senderId: user2._id,
    text: "Hidden conversation message",
    messageType: "text",
  });

  const conversation = await Conversation.findById(conversationId);

  conversation!.deletedBy = [user1._id];
  await conversation!.save();

  const response = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.messages).toHaveLength(1);
  expect(response.body.data.messages[0].text).toBe(
    "Hidden conversation message"
  );
  });

  it("should not delete a conversation when the user hides it", async () => {
  const user1 = await User.create({
    name: "Hide DB User One",
    email: "hide-db-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Hide DB User Two",
    email: "hide-db-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  const conversationBefore = await Conversation.findById(conversationId);

  expect(conversationBefore).not.toBeNull();

  conversationBefore!.deletedBy = [user1._id];
  await conversationBefore!.save();

  const conversationAfter = await Conversation.findById(conversationId);

  expect(conversationAfter).not.toBeNull();
  expect(conversationAfter!.deletedBy).toHaveLength(1);
  expect(conversationAfter!.deletedBy[0].toString()).toBe(
    user1._id.toString()
  );

  expect(await Conversation.countDocuments()).toBe(1);
  });

  it("should keep the conversation visible to the other participant after one user hides it", async () => {
  const user1 = await User.create({
    name: "Count User One",
    email: "count-user-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Count User Two",
    email: "count-user-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token1 = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token1}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  const conversation = await Conversation.findById(conversationId);

  conversation!.deletedBy = [user1._id];
  await conversation!.save();

  const token2 = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${token2}`);

  expect(response.status).toBe(200);
  expect(response.body.data.conversations).toHaveLength(1);
  expect(response.body.data.pagination.total).toBe(1);
  });

  it("should only hide the conversation for the user who hides it", async () => {
  const user1 = await User.create({
    name: "Delete By User One",
    email: "deleted-by-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Delete By User Two",
    email: "deleted-by-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token1 = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token1}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  const conversation = await Conversation.findById(conversationId);

  conversation!.deletedBy = [user1._id];
  await conversation!.save();

  const updatedConversation = await Conversation.findById(conversationId);

  expect(updatedConversation!.deletedBy).toHaveLength(1);
  expect(updatedConversation!.deletedBy[0].toString()).toBe(
    user1._id.toString()
  );

  expect(
    updatedConversation!.deletedBy.some(
      (userId) => userId.toString() === user2._id.toString()
    )
  ).toBe(false);
  });

  it("should not duplicate a user in deletedBy when hiding a conversation twice", async () => {
  const user1 = await User.create({
    name: "Duplicate Hide User One",
    email: "duplicate-hide-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Duplicate Hide User Two",
    email: "duplicate-hide-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
    createdBy: user1._id,
  });

  conversation.deletedBy = [user1._id];
  await conversation.save();

  const updatedConversation = await Conversation.findById(conversation._id);

  updatedConversation!.deletedBy = [
    ...updatedConversation!.deletedBy,
    user1._id,
  ];

  await updatedConversation!.save();

  const finalConversation = await Conversation.findById(conversation._id);

  expect(finalConversation!.deletedBy).toHaveLength(2);
  });

  it("should not duplicate deletedBy when hiding a conversation twice", async () => {
  const user1 = await User.create({
    name: "Double Hide User One",
    email: "double-hide-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Double Hide User Two",
    email: "double-hide-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  const firstResponse = await request(app)
    .delete(`/api/conversations/${conversationId}`)
    .set("Authorization", `Bearer ${token}`);

  expect(firstResponse.status).toBe(200);

  const secondResponse = await request(app)
    .delete(`/api/conversations/${conversationId}`)
    .set("Authorization", `Bearer ${token}`);

  expect(secondResponse.status).toBe(200);

  const conversation = await Conversation.findById(conversationId);

  expect(conversation).not.toBeNull();
  expect(conversation!.deletedBy).toHaveLength(1);
  expect(conversation!.deletedBy[0].toString()).toBe(
    user1._id.toString()
  );
  });

  it("should not allow a non-participant to hide a conversation", async () => {
  const user1 = await User.create({
    name: "Hide Participant One",
    email: "hide-participant-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Hide Participant Two",
    email: "hide-participant-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const outsider = await User.create({
    name: "Hide Outsider",
    email: "hide-outsider@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const participantToken = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${participantToken}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  const outsiderToken = generateAccessToken({
    userId: outsider._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .delete(`/api/conversations/${conversationId}`)
    .set("Authorization", `Bearer ${outsiderToken}`);

  expect(response.status).toBe(403);
  expect(response.body.success).toBe(false);

  const conversation = await Conversation.findById(conversationId);

  expect(conversation).not.toBeNull();
  expect(conversation!.deletedBy).toHaveLength(0);
  });

  it("should not allow unauthenticated users to hide a conversation", async () => {
  const user1 = await User.create({
    name: "Unauthenticated Hide One",
    email: "unauth-hide-one@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Unauthenticated Hide Two",
    email: "unauth-hide-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  const response = await request(app).delete(
    `/api/conversations/${conversationId}`
  );

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);

  const conversation = await Conversation.findById(conversationId);

  expect(conversation).not.toBeNull();
  expect(conversation!.deletedBy).toHaveLength(0);
  });

  it("should reject an invalid conversation ID when hiding a conversation", async () => {
  const user = await User.create({
    name: "Invalid Hide ID User",
    email: "invalid-hide-id@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .delete("/api/conversations/invalid-conversation-id")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  expect(await Conversation.countDocuments()).toBe(0);
  });

  it("should return 404 when hiding a non-existent conversation", async () => {
  const user = await User.create({
    name: "Missing Hide Conversation User",
    email: "missing-hide-conversation@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const fakeConversationId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .delete(`/api/conversations/${fakeConversationId}`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);

  expect(await Conversation.countDocuments()).toBe(0);
  });

  it("should reject hiding a conversation by a non-participant", async () => {
  const user1 = await User.create({
    name: "Conversation Owner",
    email: "conversation-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Conversation Participant",
    email: "conversation-participant@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const attacker = await User.create({
    name: "Attacker",
    email: "conversation-attacker@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const conversationResponse = await request(app)
    .post("/api/conversations")
    .set(
      "Authorization",
      `Bearer ${generateAccessToken({
        userId: user1._id.toString(),
        role: "user",
      })}`
    )
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = conversationResponse.body.data._id;

  const attackerToken = generateAccessToken({
    userId: attacker._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .delete(`/api/conversations/${conversationId}`)
    .set("Authorization", `Bearer ${attackerToken}`);

  expect(response.status).toBe(403);
  expect(response.body.success).toBe(false);

  const conversation = await Conversation.findById(conversationId);

  expect(conversation).not.toBeNull();
  expect(conversation!.deletedBy).toHaveLength(0);
  });

  it("should not return a conversation after the user hides it", async () => {
  const user1 = await User.create({
    name: "Hide List User",
    email: "hide-list-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Hide List Participant",
    email: "hide-list-participant@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  const hideResponse = await request(app)
    .delete(`/api/conversations/${conversationId}`)
    .set("Authorization", `Bearer ${token}`);

  expect(hideResponse.status).toBe(200);

  const listResponse = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${token}`);

  expect(listResponse.status).toBe(200);

  expect(
    listResponse.body.data.conversations.some(
      (conversation: { _id: string }) =>
        conversation._id === conversationId
    )
  ).toBe(false);
  });

  it("should keep the conversation visible to the other participant after one user hides it", async () => {
  const user1 = await User.create({
    name: "Hiding User",
    email: "hiding-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user2 = await User.create({
    name: "Other Participant",
    email: "other-participant@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token1 = generateAccessToken({
    userId: user1._id.toString(),
    role: "user",
  });

  const token2 = generateAccessToken({
    userId: user2._id.toString(),
    role: "user",
  });

  const createResponse = await request(app)
    .post("/api/conversations")
    .set("Authorization", `Bearer ${token1}`)
    .send({
      otherUserId: user2._id.toString(),
    });

  const conversationId = createResponse.body.data._id;

  const hideResponse = await request(app)
    .delete(`/api/conversations/${conversationId}`)
    .set("Authorization", `Bearer ${token1}`);

  expect(hideResponse.status).toBe(200);

  const listResponse = await request(app)
    .get("/api/conversations")
    .set("Authorization", `Bearer ${token2}`);

  expect(listResponse.status).toBe(200);

  expect(
    listResponse.body.data.conversations.some(
      (conversation: { _id: string }) =>
        conversation._id === conversationId
    )
  ).toBe(true);
  });
});