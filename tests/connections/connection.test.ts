import request from "supertest";
import mongoose from "mongoose";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../../src/app.js";
import { User } from "../../src/models/user.model.js";
import { Connection } from "../../src/models/connection.model.js";
import { Notification } from "../../src/models/notification.model.js";
import { generateAccessToken } from "../../src/utils/jwt.util.js";

describe("Connections", () => {
    beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });
  
  it("should send a connection request", async () => {
    // Arrange
    const sender = await User.create({
      name: "Sender User",
      email: "sender@test.com",
      passwordHash: "test-hash",
      authMethod: "email",
    });

    const receiver = await User.create({
      name: "Receiver User",
      email: "receiver@test.com",
      passwordHash: "test-hash",
      authMethod: "email",
    });

    const accessToken = generateAccessToken({
      userId: sender._id.toString(),
      role: sender.role,
    });

    // Act
    const response = await request(app)
      .post("/api/connections/request")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        receiverId: receiver._id.toString(),
      });

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Connection request sent");

    const connection = await Connection.findOne({
      senderId: sender._id,
      receiverId: receiver._id,
    });

    expect(connection).toBeDefined();
    expect(connection!.status).toBe("pending");

    const notification = await Notification.findOne({
      receiverId: receiver._id,
      senderId: sender._id,
      type: "connection_request",
    });

    expect(notification).toBeDefined();
  });

  it("should not allow a user to send a connection request to themselves", async () => {
  const user = await User.create({
    name: "Self User",
    email: "self@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      receiverId: user._id.toString(),
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe(
    "You cannot send a connection request to yourself"
  );

  const connection = await Connection.findOne({
    senderId: user._id,
    receiverId: user._id,
  });

  expect(connection).toBeNull();
  });

  it("should reject request when receiver does not exist", async () => {
  const sender = await User.create({
    name: "Sender User",
    email: "sender2@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const fakeReceiverId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      receiverId: fakeReceiverId.toString(),
    });

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("User not found");

  const connection = await Connection.findOne({
    senderId: sender._id,
    receiverId: fakeReceiverId,
  });

  expect(connection).toBeNull();
  });

  it("should reject a duplicate connection request", async () => {
  const sender = await User.create({
    name: "Sender User",
    email: "sender3@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Receiver User",
    email: "receiver3@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  // First request
  const firstResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(firstResponse.status).toBe(201);

  // Duplicate request
  const secondResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(secondResponse.status).toBe(400);
  expect(secondResponse.body.message).toBe(
    "A connection request already exists between you and this user"
  );

  const connections = await Connection.find({
    $or: [
      { senderId: sender._id, receiverId: receiver._id },
      { senderId: receiver._id, receiverId: sender._id },
    ],
  });

  expect(connections).toHaveLength(1);
  });

  it("should reject a reverse-direction duplicate connection request", async () => {
  const userA = await User.create({
    name: "User A",
    email: "usera@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "User B",
    email: "userb@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: userA.role,
  });

  const tokenB = generateAccessToken({
    userId: userB._id.toString(),
    role: userB.role,
  });

  // A sends request to B
  const firstResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      receiverId: userB._id.toString(),
    });

  expect(firstResponse.status).toBe(201);

  // B tries to send request to A
  const secondResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({
      receiverId: userA._id.toString(),
    });

  expect(secondResponse.status).toBe(400);
  expect(secondResponse.body.message).toBe(
    "A connection request already exists between you and this user"
  );

  const connections = await Connection.find({
    $or: [
      { senderId: userA._id, receiverId: userB._id },
      { senderId: userB._id, receiverId: userA._id },
    ],
  });

  expect(connections).toHaveLength(1);
  });

  it("should reject unauthenticated connection request", async () => {
  const receiver = await User.create({
    name: "Receiver User",
    email: "receiver4@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const response = await request(app)
    .post("/api/connections/request")
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(response.status).toBe(401);
  expect(response.body.message).toBe(
    "Not authenticated - token missing"
  );

  const connections = await Connection.find({
    receiverId: receiver._id,
  });

  expect(connections).toHaveLength(0);
  });

  it("should allow receiver to accept a connection request", async () => {
  const sender = await User.create({
    name: "Sender User",
    email: "sender5@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Receiver User",
    email: "receiver5@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const senderToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const receiverToken = generateAccessToken({
    userId: receiver._id.toString(),
    role: receiver.role,
  });

  // Sender sends request
  const requestResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${senderToken}`)
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(requestResponse.status).toBe(201);

  const connectionId = requestResponse.body.data._id;

  // Receiver accepts request
  const acceptResponse = await request(app)
    .put(`/api/connections/${connectionId}/accept`)
    .set("Authorization", `Bearer ${receiverToken}`);

  expect(acceptResponse.status).toBe(200);
  expect(acceptResponse.body.message).toBe(
    "Connection request accepted"
  );

  const connection = await Connection.findById(connectionId);

  expect(connection).toBeDefined();
  expect(connection?.status).toBe("accepted");

  const notification = await Notification.findOne({
    receiverId: sender._id,
    senderId: receiver._id,
    type: "connection_accepted",
    refId: connectionId,
  });

  expect(notification).toBeDefined();
  });

  it("should not allow sender to accept their own connection request", async () => {
  const sender = await User.create({
    name: "Sender User",
    email: "sender6@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Receiver User",
    email: "receiver6@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const senderToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const createResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${senderToken}`)
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(createResponse.status).toBe(201);

  const connectionId = createResponse.body.data._id;

  const acceptResponse = await request(app)
    .put(`/api/connections/${connectionId}/accept`)
    .set("Authorization", `Bearer ${senderToken}`);

  expect(acceptResponse.status).toBe(403);
  expect(acceptResponse.body.message).toBe(
    "You are not authorized to accept this request"
  );

  const connection = await Connection.findById(connectionId);

  expect(connection?.status).toBe("pending");
  });

  it("should not allow an already accepted request to be accepted again", async () => {
  const sender = await User.create({
    name: "Sender User",
    email: "sender7@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Receiver User",
    email: "receiver7@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const senderToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const receiverToken = generateAccessToken({
    userId: receiver._id.toString(),
    role: receiver.role,
  });

  // Create request
  const createResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${senderToken}`)
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(createResponse.status).toBe(201);

  const connectionId = createResponse.body.data._id;

  // First accept
  const firstAcceptResponse = await request(app)
    .put(`/api/connections/${connectionId}/accept`)
    .set("Authorization", `Bearer ${receiverToken}`);

  expect(firstAcceptResponse.status).toBe(200);

  // Second accept
  const secondAcceptResponse = await request(app)
    .put(`/api/connections/${connectionId}/accept`)
    .set("Authorization", `Bearer ${receiverToken}`);

  expect(secondAcceptResponse.status).toBe(400);
  expect(secondAcceptResponse.body.message).toBe(
    "This request has already been processed"
  );

  const connection = await Connection.findById(connectionId);

  expect(connection?.status).toBe("accepted");
  });

  it("should reject unauthenticated accept request", async () => {
  const sender = await User.create({
    name: "Sender User",
    email: "sender8@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Receiver User",
    email: "receiver8@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const senderToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const createResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${senderToken}`)
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(createResponse.status).toBe(201);

  const connectionId = createResponse.body.data._id;

  const acceptResponse = await request(app)
    .put(`/api/connections/${connectionId}/accept`);

  expect(acceptResponse.status).toBe(401);
  expect(acceptResponse.body.message).toBe(
    "Not authenticated - token missing"
  );

  const connection = await Connection.findById(connectionId);

  expect(connection?.status).toBe("pending");
  });

  it("should allow receiver to reject a connection request", async () => {
  const sender = await User.create({
    name: "Sender User",
    email: "sender9@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Receiver User",
    email: "receiver9@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const senderToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const receiverToken = generateAccessToken({
    userId: receiver._id.toString(),
    role: receiver.role,
  });

  // Sender sends request
  const createResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${senderToken}`)
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(createResponse.status).toBe(201);

  const connectionId = createResponse.body.data._id;

  // Receiver rejects request
  const rejectResponse = await request(app)
    .delete(`/api/connections/${connectionId}/reject`)
    .set("Authorization", `Bearer ${receiverToken}`);

  expect(rejectResponse.status).toBe(200);
  expect(rejectResponse.body.message).toBe(
    "Connection request rejected"
  );

  // Connection should be deleted
  const connection = await Connection.findById(connectionId);

  expect(connection).toBeNull();
  });

  it("should not allow sender to reject their own connection request", async () => {
  const sender = await User.create({
    name: "Sender User",
    email: "sender10@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Receiver User",
    email: "receiver10@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const senderToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const createResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${senderToken}`)
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(createResponse.status).toBe(201);

  const connectionId = createResponse.body.data._id;

  // Sender tries to reject their own request
  const rejectResponse = await request(app)
    .delete(`/api/connections/${connectionId}/reject`)
    .set("Authorization", `Bearer ${senderToken}`);

  expect(rejectResponse.status).toBe(403);
  expect(rejectResponse.body.message).toBe(
    "You are not authorized to reject this request"
  );

  const connection = await Connection.findById(connectionId);

  expect(connection).toBeDefined();
  expect(connection?.status).toBe("pending");
  });

  it("should reject unauthenticated reject request", async () => {
  const sender = await User.create({
    name: "Sender User",
    email: "sender11@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Receiver User",
    email: "receiver11@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const senderToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const createResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${senderToken}`)
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(createResponse.status).toBe(201);

  const connectionId = createResponse.body.data._id;

  const rejectResponse = await request(app)
    .delete(`/api/connections/${connectionId}/reject`);

  expect(rejectResponse.status).toBe(401);
  expect(rejectResponse.body.message).toBe(
    "Not authenticated - token missing"
  );

  const connection = await Connection.findById(connectionId);

  expect(connection).toBeDefined();
  expect(connection?.status).toBe("pending");
  });

  it("should return accepted connections for the authenticated user", async () => {
  const userA = await User.create({
    name: "User A",
    email: "usera12@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "User B",
    email: "userb12@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: userA.role,
  });

  const tokenB = generateAccessToken({
    userId: userB._id.toString(),
    role: userB.role,
  });

  // Create request
  const createResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      receiverId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(201);

  const connectionId = createResponse.body.data._id;

  // Accept request
  const acceptResponse = await request(app)
    .put(`/api/connections/${connectionId}/accept`)
    .set("Authorization", `Bearer ${tokenB}`);

  expect(acceptResponse.status).toBe(200);

  // Get connections for User A
  const response = await request(app)
    .get("/api/connections")
    .set("Authorization", `Bearer ${tokenA}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data).toHaveLength(1);

  expect(response.body.data[0].connectionId).toBe(connectionId);
  expect(response.body.data[0].user._id).toBe(userB._id.toString());
  expect(response.body.data[0].user.name).toBe("User B");
  });

  it("should return the same accepted connection for both users", async () => {
  const userA = await User.create({
    name: "User A",
    email: "usera13@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "User B",
    email: "userb13@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: userA.role,
  });

  const tokenB = generateAccessToken({
    userId: userB._id.toString(),
    role: userB.role,
  });

  // A sends request to B
  const createResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      receiverId: userB._id.toString(),
    });

  expect(createResponse.status).toBe(201);

  const connectionId = createResponse.body.data._id;

  // B accepts request
  const acceptResponse = await request(app)
    .put(`/api/connections/${connectionId}/accept`)
    .set("Authorization", `Bearer ${tokenB}`);

  expect(acceptResponse.status).toBe(200);

  // A gets connections
  const responseA = await request(app)
    .get("/api/connections")
    .set("Authorization", `Bearer ${tokenA}`);

  expect(responseA.status).toBe(200);
  expect(responseA.body.data).toHaveLength(1);
  expect(responseA.body.data[0].user._id).toBe(userB._id.toString());

  // B gets connections
  const responseB = await request(app)
    .get("/api/connections")
    .set("Authorization", `Bearer ${tokenB}`);

  expect(responseB.status).toBe(200);
  expect(responseB.body.data).toHaveLength(1);
  expect(responseB.body.data[0].user._id).toBe(userA._id.toString());

  // Both users should see the same connection
  expect(responseA.body.data[0].connectionId).toBe(connectionId);
  expect(responseB.body.data[0].connectionId).toBe(connectionId);
  });

  it("should reject unauthenticated get connections request", async () => {
  const response = await request(app)
    .get("/api/connections");

  expect(response.status).toBe(401);
  expect(response.body.message).toBe(
    "Not authenticated - token missing"
  );
  });

  it("should not return pending requests in connections", async () => {
  const sender = await User.create({
    name: "Sender User",
    email: "sender14@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Receiver User",
    email: "receiver14@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const senderToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const receiverToken = generateAccessToken({
    userId: receiver._id.toString(),
    role: receiver.role,
  });

  // Sender sends a pending request
  const createResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${senderToken}`)
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(createResponse.status).toBe(201);

  // Receiver checks normal connections
  const response = await request(app)
    .get("/api/connections")
    .set("Authorization", `Bearer ${receiverToken}`);

  expect(response.status).toBe(200);
  expect(response.body.data).toHaveLength(0);
  });

  it("should return pending requests for the receiver", async () => {
  const sender = await User.create({
    name: "Sender User",
    email: "sender15@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Receiver User",
    email: "receiver15@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const senderToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const receiverToken = generateAccessToken({
    userId: receiver._id.toString(),
    role: receiver.role,
  });

  // Sender sends request
  const createResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${senderToken}`)
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(createResponse.status).toBe(201);

  const connectionId = createResponse.body.data._id;

  // Receiver gets pending requests
  const response = await request(app)
    .get("/api/connections/pending")
    .set("Authorization", `Bearer ${receiverToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data).toHaveLength(1);

  expect(response.body.data[0]._id).toBe(connectionId);
  expect(response.body.data[0].senderId._id).toBe(sender._id.toString());
  expect(response.body.data[0].senderId.name).toBe("Sender User");
  expect(response.body.data[0].status).toBe("pending");
  });

  it("should not return pending requests to the sender", async () => {
  const sender = await User.create({
    name: "Sender User",
    email: "sender16@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Receiver User",
    email: "receiver16@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const senderToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const receiverToken = generateAccessToken({
    userId: receiver._id.toString(),
    role: receiver.role,
  });

  // Sender sends request
  const createResponse = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${senderToken}`)
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(createResponse.status).toBe(201);

  // Receiver should see the pending request
  const receiverResponse = await request(app)
    .get("/api/connections/pending")
    .set("Authorization", `Bearer ${receiverToken}`);

  expect(receiverResponse.status).toBe(200);
  expect(receiverResponse.body.data).toHaveLength(1);

  // Sender should not see it
  const senderResponse = await request(app)
    .get("/api/connections/pending")
    .set("Authorization", `Bearer ${senderToken}`);

  expect(senderResponse.status).toBe(200);
  expect(senderResponse.body.data).toHaveLength(0);
  });

  it("should reject unauthenticated get pending requests", async () => {
  const response = await request(app)
    .get("/api/connections/pending");

  expect(response.status).toBe(401);
  expect(response.body.message).toBe(
    "Not authenticated - token missing"
  );
  });

  it("should reject invalid connection ID when accepting", async () => {
  const user = await User.create({
    name: "User Invalid ID",
    email: "invalidid@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .put("/api/connections/not-a-valid-id/accept")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.message).toBe("Invalid Connection ID");
  });

  it("should reject invalid connection ID when rejecting", async () => {
  const user = await User.create({
    name: "User Invalid Reject ID",
    email: "invalidrejectid@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .delete("/api/connections/not-a-valid-id/reject")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.message).toBe("Invalid Connection ID");
  });

  it("should return 404 when accepting a non-existing connection", async () => {
  const user = await User.create({
    name: "User Missing Connection",
    email: "missingconnection@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const nonExistingConnectionId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .put(`/api/connections/${nonExistingConnectionId}/accept`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe(
    "Connection request not found"
  );
  });

  it("should return 404 when rejecting a non-existing connection", async () => {
  const user = await User.create({
    name: "User Missing Connection",
    email: "missingreject@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const nonExistingConnectionId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .delete(`/api/connections/${nonExistingConnectionId}/reject`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe(
    "Connection request not found"
  );
  });

  it("should not allow an accepted connection to be rejected", async () => {
  const sender = await User.create({
    name: "Sender User",
    email: "accepted-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Receiver User",
    email: "accepted-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const connection = await Connection.create({
    senderId: sender._id,
    receiverId: receiver._id,
    status: "accepted",
  });

  const accessToken = generateAccessToken({
    userId: receiver._id.toString(),
    role: receiver.role,
  });

  const response = await request(app)
    .delete(`/api/connections/${connection._id}/reject`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.message).toBe(
    "This request has already been processed"
  );
  });

  it("should keep an accepted connection unchanged when rejection is attempted", async () => {
  const sender = await User.create({
    name: "Accepted Sender",
    email: "accepted-db-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Accepted Receiver",
    email: "accepted-db-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const connection = await Connection.create({
    senderId: sender._id,
    receiverId: receiver._id,
    status: "accepted",
  });

  const accessToken = generateAccessToken({
    userId: receiver._id.toString(),
    role: receiver.role,
  });

  const response = await request(app)
    .delete(`/api/connections/${connection._id}/reject`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);

  const connectionAfterRequest = await Connection.findById(connection._id);

  expect(connectionAfterRequest).not.toBeNull();
  expect(connectionAfterRequest?.status).toBe("accepted");
  });

  it("should not return an accepted connection in pending requests", async () => {
  const sender = await User.create({
    name: "Pending Sender",
    email: "pending-sender-accepted@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Pending Receiver",
    email: "pending-receiver-accepted@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Connection.create({
    senderId: sender._id,
    receiverId: receiver._id,
    status: "accepted",
  });

  const accessToken = generateAccessToken({
    userId: receiver._id.toString(),
    role: receiver.role,
  });

  const response = await request(app)
    .get("/api/connections/pending")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.data).toHaveLength(0);
  });

  it("should return multiple accepted connections", async () => {
  const user = await User.create({
    name: "Main User",
    email: "main-multiple@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userTwo = await User.create({
    name: "Connection Two",
    email: "connection-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userThree = await User.create({
    name: "Connection Three",
    email: "connection-three@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Connection.create([
    {
      senderId: user._id,
      receiverId: userTwo._id,
      status: "accepted",
    },
    {
      senderId: userThree._id,
      receiverId: user._id,
      status: "accepted",
    },
  ]);

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .get("/api/connections")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.data).toHaveLength(2);

  const connectedUserIds = response.body.data.map(
    (connection: { user: { _id: string } }) => connection.user._id
  );

  expect(connectedUserIds).toContain(userTwo._id.toString());
  expect(connectedUserIds).toContain(userThree._id.toString());
  });

  it("should not allow a new request when users are already connected", async () => {
  const sender = await User.create({
    name: "Connected Sender",
    email: "connected-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Connected Receiver",
    email: "connected-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Connection.create({
    senderId: sender._id,
    receiverId: receiver._id,
    status: "accepted",
  });

  const accessToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const response = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      receiverId: receiver._id.toString(),
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe(
    "You are already connected with this user"
  );

  const connections = await Connection.find({
    $or: [
      { senderId: sender._id, receiverId: receiver._id },
      { senderId: receiver._id, receiverId: sender._id },
    ],
  });

  expect(connections).toHaveLength(1);
  expect(connections[0].status).toBe("accepted");
  });

  it("should reject an invalid receiver ID", async () => {
  const sender = await User.create({
    name: "Invalid Receiver Sender",
    email: "invalid-receiver-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const response = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      receiverId: "abc",
    });

  expect(response.status).toBe(400);

  const connections = await Connection.find({
    senderId: sender._id,
  });

  expect(connections).toHaveLength(0);
  });

  it("should reject a connection request without receiver ID", async () => {
  const sender = await User.create({
    name: "Missing Receiver Sender",
    email: "missing-receiver-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: sender._id.toString(),
    role: sender.role,
  });

  const response = await request(app)
    .post("/api/connections/request")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({});

  expect(response.status).toBe(400);

  const connections = await Connection.find({
    senderId: sender._id,
  });

  expect(connections).toHaveLength(0);
  });

  it("should remove an accepted request from pending requests", async () => {
  const sender = await User.create({
    name: "Transition Sender",
    email: "transition-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const receiver = await User.create({
    name: "Transition Receiver",
    email: "transition-receiver@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const connection = await Connection.create({
    senderId: sender._id,
    receiverId: receiver._id,
    status: "pending",
  });

  const accessToken = generateAccessToken({
    userId: receiver._id.toString(),
    role: receiver.role,
  });

  const acceptResponse = await request(app)
    .put(`/api/connections/${connection._id}/accept`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(acceptResponse.status).toBe(200);

  const pendingResponse = await request(app)
    .get("/api/connections/pending")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(pendingResponse.status).toBe(200);
  expect(pendingResponse.body.data).toHaveLength(0);
  });

}); 