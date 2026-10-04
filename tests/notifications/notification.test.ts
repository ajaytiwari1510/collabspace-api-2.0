import mongoose from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { User } from "../../src/models/user.model.js";
import { Notification } from "../../src/models/notification.model.js";
import { generateAccessToken } from "../../src/utils/jwt.util.js";

describe("Notifications", () => {
  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  it("should return the user's notifications", async () => {
    const user = await User.create({
      name: "Notification User",
      email: "notification-user@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    const sender = await User.create({
      name: "Notification Sender",
      email: "notification-sender@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    await Notification.create({
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "sent you a connection request",
      isRead: false,
    });

    const token = generateAccessToken({
      userId: user._id.toString(),
      role: "user",
    });

    const response = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body.data.notifications).toHaveLength(1);

    expect(response.body.data.notifications[0].message).toBe(
      "sent you a connection request"
    );

    expect(response.body.data.notifications[0].senderId.name).toBe(
      "Notification Sender"
    );

    expect(response.body.data.unreadCount).toBe(1);

    expect(response.body.data.pagination.page).toBe(1);
    expect(response.body.data.pagination.limit).toBe(10);
    expect(response.body.data.pagination.total).toBe(1);
    expect(response.body.data.pagination.hasMore).toBe(false);
  });

  it("should return only notifications belonging to the authenticated user", async () => {
  const userA = await User.create({
    name: "Notification User A",
    email: "notification-user-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "Notification User B",
    email: "notification-user-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Notification Sender",
    email: "notification-sender-2@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Notification.create([
    {
      receiverId: userA._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Notification for User A",
      isRead: false,
    },
    {
      receiverId: userB._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Notification for User B",
      isRead: false,
    },
  ]);

  const token = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/notifications")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.notifications).toHaveLength(1);

  expect(response.body.data.notifications[0].message).toBe(
    "Notification for User A"
  );

  expect(response.body.data.unreadCount).toBe(1);
  });

  it("should not allow unauthenticated users to fetch notifications", async () => {
  const response = await request(app)
    .get("/api/notifications");

  expect(response.status).toBe(401);
  });

  it("should return only unread notifications when unread=true", async () => {
  const user = await User.create({
    name: "Unread Filter User",
    email: "unread-filter@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Unread Filter Sender",
    email: "unread-filter-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Notification.create([
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Unread notification",
      isRead: false,
    },
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_accepted",
      message: "Read notification",
      isRead: true,
    },
  ]);

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/notifications?unread=true")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.notifications).toHaveLength(1);

  expect(response.body.data.notifications[0].message).toBe(
    "Unread notification"
  );

  expect(response.body.data.notifications[0].isRead).toBe(false);

  expect(response.body.data.unreadCount).toBe(1);

  expect(response.body.data.pagination.total).toBe(1);
  });

  it("should return all notifications when unread=false", async () => {
  const user = await User.create({
    name: "Read Filter User",
    email: "read-filter@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Read Filter Sender",
    email: "read-filter-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Notification.create([
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Unread notification",
      isRead: false,
    },
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_accepted",
      message: "Read notification",
      isRead: true,
    },
  ]);

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/notifications?unread=false")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.notifications).toHaveLength(2);

  expect(response.body.data.pagination.total).toBe(2);
  expect(response.body.data.unreadCount).toBe(1);
  });

  it("should reject an invalid unread query parameter", async () => {
  const user = await User.create({
    name: "Invalid Unread User",
    email: "invalid-unread@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/notifications?unread=yes")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(400);

  expect(response.body.message).toBe(
    "The unread query parameter must be true or false"
  );
  });

  it("should paginate notifications correctly", async () => {
  const user = await User.create({
    name: "Pagination User",
    email: "notification-pagination@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Pagination Sender",
    email: "notification-pagination-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Notification.create([
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Notification 1",
      isRead: false,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
    },
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Notification 2",
      isRead: false,
      createdAt: new Date("2026-01-01T10:01:00.000Z"),
    },
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Notification 3",
      isRead: false,
      createdAt: new Date("2026-01-01T10:02:00.000Z"),
    },
  ]);

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/notifications?page=1&limit=2")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.notifications).toHaveLength(2);

  expect(response.body.data.notifications[0].message).toBe(
    "Notification 3"
  );

  expect(response.body.data.notifications[1].message).toBe(
    "Notification 2"
  );

  expect(response.body.data.pagination.page).toBe(1);
  expect(response.body.data.pagination.limit).toBe(2);
  expect(response.body.data.pagination.total).toBe(3);
  expect(response.body.data.pagination.hasMore).toBe(true);
  });

  it("should return the second page of notifications correctly", async () => {
  const user = await User.create({
    name: "Second Page User",
    email: "notification-page-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Second Page Sender",
    email: "notification-page-two-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Notification.create([
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Notification 1",
      isRead: false,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
    },
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Notification 2",
      isRead: false,
      createdAt: new Date("2026-01-01T10:01:00.000Z"),
    },
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Notification 3",
      isRead: false,
      createdAt: new Date("2026-01-01T10:02:00.000Z"),
    },
  ]);

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/notifications?page=2&limit=2")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.notifications).toHaveLength(1);

  expect(response.body.data.notifications[0].message).toBe(
    "Notification 1"
  );

  expect(response.body.data.pagination.page).toBe(2);
  expect(response.body.data.pagination.limit).toBe(2);
  expect(response.body.data.pagination.total).toBe(3);
  expect(response.body.data.pagination.hasMore).toBe(false);
  });

  it("should mark a notification as read", async () => {
  const user = await User.create({
    name: "Mark Read User",
    email: "mark-read@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Mark Read Sender",
    email: "mark-read-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const notification = await Notification.create({
    receiverId: user._id,
    senderId: sender._id,
    type: "connection_request",
    message: "Please mark me as read",
    isRead: false,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .patch(`/api/notifications/${notification._id}/read`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data.isRead).toBe(true);

  const updatedNotification = await Notification.findById(notification._id);

  expect(updatedNotification?.isRead).toBe(true);
  });

  it("should not allow a user to mark another user's notification as read", async () => {
  const owner = await User.create({
    name: "Notification Owner",
    email: "notification-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const otherUser = await User.create({
    name: "Other Notification User",
    email: "other-notification-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Authorization Sender",
    email: "notification-auth-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const notification = await Notification.create({
    receiverId: owner._id,
    senderId: sender._id,
    type: "connection_request",
    message: "Private notification",
    isRead: false,
  });

  const token = generateAccessToken({
    userId: otherUser._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .patch(`/api/notifications/${notification._id}/read`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(403);

  const unchangedNotification = await Notification.findById(
    notification._id
  );

  expect(unchangedNotification?.isRead).toBe(false);
  });

  it("should reject an invalid notification ID when marking as read", async () => {
  const user = await User.create({
    name: "Invalid Notification ID User",
    email: "invalid-notification-id@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .patch("/api/notifications/invalid-notification-id/read")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(400);
  });

  it("should return 404 when marking a non-existent notification as read", async () => {
  const user = await User.create({
    name: "Missing Notification User",
    email: "missing-notification@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .patch(`/api/notifications/${new mongoose.Types.ObjectId()}/read`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("Notification Not Found");
  });

  it("should not allow unauthenticated users to mark notifications as read", async () => {
  const user = await User.create({
    name: "Unauthenticated Read User",
    email: "unauth-read-notification@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Unauthenticated Read Sender",
    email: "unauth-read-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const notification = await Notification.create({
    receiverId: user._id,
    senderId: sender._id,
    type: "connection_request",
    message: "Protected notification",
    isRead: false,
  });

  const response = await request(app)
    .patch(`/api/notifications/${notification._id}/read`);

  expect(response.status).toBe(401);

  const unchangedNotification = await Notification.findById(
    notification._id
  );

  expect(unchangedNotification?.isRead).toBe(false);
  });

  it("should mark all unread notifications as read", async () => {
  const user = await User.create({
    name: "Mark All User",
    email: "mark-all@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Mark All Sender",
    email: "mark-all-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Notification.create([
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Unread notification 1",
      isRead: false,
    },
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_accepted",
      message: "Unread notification 2",
      isRead: false,
    },
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "post_liked",
      message: "Already read notification",
      isRead: true,
    },
  ]);

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .patch("/api/notifications/read-all")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.message).toBe("All notifications maked as Read");

  const notifications = await Notification.find({
    receiverId: user._id,
  });

  expect(notifications).toHaveLength(3);

  expect(notifications.every((notification) => notification.isRead)).toBe(
    true
  );
  });

  it("should not allow unauthenticated users to mark all notifications as read", async () => {
  const response = await request(app)
    .patch("/api/notifications/read-all");

  expect(response.status).toBe(401);
  });

  it("should allow a user to delete their notification", async () => {
  const user = await User.create({
    name: "Delete Notification User",
    email: "delete-notification@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Delete Notification Sender",
    email: "delete-notification-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const notification = await Notification.create({
    receiverId: user._id,
    senderId: sender._id,
    type: "connection_request",
    message: "Notification to delete",
    isRead: false,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .delete(`/api/notifications/${notification._id}`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.message).toBe("Notification Deleted");

  const deletedNotification = await Notification.findById(notification._id);

  expect(deletedNotification).toBeNull();
  });

  it("should not allow a user to delete another user's notification", async () => {
  const owner = await User.create({
    name: "Notification Owner",
    email: "notification-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const otherUser = await User.create({
    name: "Other User",
    email: "other-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const notification = await Notification.create({
    receiverId: owner._id,
    senderId: otherUser._id,
    type: "connection_request",
    message: "Owner notification",
    isRead: false,
  });

  const token = generateAccessToken({
    userId: otherUser._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .delete(`/api/notifications/${notification._id}`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(403);

  const existingNotification = await Notification.findById(
    notification._id,
  );

  expect(existingNotification).not.toBeNull();
  });

  it("should not allow unauthenticated users to delete notifications", async () => {
  const user = await User.create({
    name: "Notification Owner",
    email: "unauth-delete@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Notification Sender",
    email: "unauth-delete-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const notification = await Notification.create({
    receiverId: user._id,
    senderId: sender._id,
    type: "connection_request",
    message: "Protected notification",
    isRead: false,
  });

  const response = await request(app)
    .delete(`/api/notifications/${notification._id}`);

  expect(response.status).toBe(401);

  const existingNotification = await Notification.findById(
    notification._id,
  );

  expect(existingNotification).not.toBeNull();
  });

  it("should reject an invalid notification ID when deleting", async () => {
  const user = await User.create({
    name: "Invalid Delete User",
    email: "invalid-delete@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .delete("/api/notifications/not-a-valid-id")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(400);
  });

  it("should return 404 when deleting a non-existent notification", async () => {
  const user = await User.create({
    name: "Missing Notification User",
    email: "missing-notification@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const notificationId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .delete(`/api/notifications/${notificationId}`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(404);

  expect(response.body.message).toBe("Notification not found");
  });

  it("should mark only the authenticated user's notifications as read", async () => {
  const userA = await User.create({
    name: "User A",
    email: "mark-all-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "User B",
    email: "mark-all-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const notificationA = await Notification.create({
    receiverId: userA._id,
    senderId: userB._id,
    type: "connection_request",
    message: "Notification for A",
    isRead: false,
  });

  const notificationB = await Notification.create({
    receiverId: userB._id,
    senderId: userA._id,
    type: "connection_request",
    message: "Notification for B",
    isRead: false,
  });

  const tokenA = generateAccessToken({
    userId: userA._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .patch("/api/notifications/read-all")
    .set("Authorization", `Bearer ${tokenA}`);

  expect(response.status).toBe(200);

  const updatedA = await Notification.findById(notificationA._id);
  const updatedB = await Notification.findById(notificationB._id);

  expect(updatedA?.isRead).toBe(true);
  expect(updatedB?.isRead).toBe(false);
  });

  it("should return an empty notification list when the user has no notifications", async () => {
  const user = await User.create({
    name: "Empty Notification User",
    email: "empty-notifications@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/notifications")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.notifications).toHaveLength(0);
  expect(response.body.data.unreadCount).toBe(0);
  expect(response.body.data.pagination.total).toBe(0);
  expect(response.body.data.pagination.hasMore).toBe(false);
  });

  it("should paginate unread notifications correctly", async () => {
  const user = await User.create({
    name: "Unread Pagination User",
    email: "unread-pagination@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Unread Pagination Sender",
    email: "unread-pagination-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Notification.create([
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Unread 1",
      isRead: false,
      createdAt: new Date("2026-01-01T10:00:00Z"),
    },
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Unread 2",
      isRead: false,
      createdAt: new Date("2026-01-01T10:01:00Z"),
    },
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Unread 3",
      isRead: false,
      createdAt: new Date("2026-01-01T10:02:00Z"),
    },
    {
      receiverId: user._id,
      senderId: sender._id,
      type: "connection_request",
      message: "Read notification",
      isRead: true,
      createdAt: new Date("2026-01-01T10:03:00Z"),
    },
  ]);

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/notifications?page=1&limit=2&unread=true")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.notifications).toHaveLength(2);
  expect(
    response.body.data.notifications.every(
      (notification: { isRead: boolean }) => notification.isRead === false,
    ),
  ).toBe(true);

  expect(response.body.data.pagination.total).toBe(3);
  expect(response.body.data.pagination.hasMore).toBe(true);
  expect(response.body.data.unreadCount).toBe(3);
  });

  it("should successfully mark all when there are no unread notifications", async () => {
  const user = await User.create({
    name: "Already Read User",
    email: "already-read@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Notification Sender",
    email: "already-read-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Notification.create({
    receiverId: user._id,
    senderId: sender._id,
    type: "connection_request",
    message: "Already read",
    isRead: true,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .patch("/api/notifications/read-all")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.message).toBe("All notifications maked as Read");

  const notifications = await Notification.find({
    receiverId: user._id,
  });

  expect(notifications).toHaveLength(1);
  expect(notifications[0].isRead).toBe(true);
  });

  it("should not return a deleted notification", async () => {
  const user = await User.create({
    name: "Deleted Notification User",
    email: "deleted-notification@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const sender = await User.create({
    name: "Notification Sender",
    email: "deleted-notification-sender@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const notification = await Notification.create({
    receiverId: user._id,
    senderId: sender._id,
    type: "connection_request",
    message: "This notification will be deleted",
    isRead: false,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const deleteResponse = await request(app)
    .delete(`/api/notifications/${notification._id}`)
    .set("Authorization", `Bearer ${token}`);

  expect(deleteResponse.status).toBe(200);

  const getResponse = await request(app)
    .get("/api/notifications")
    .set("Authorization", `Bearer ${token}`);

  expect(getResponse.status).toBe(200);
  expect(getResponse.body.data.notifications).toHaveLength(0);
  expect(getResponse.body.data.unreadCount).toBe(0);
  });

});