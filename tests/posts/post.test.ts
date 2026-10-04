import request from "supertest";
import mongoose from "mongoose";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../src/socket/index.js", () => ({
  getIO: vi.fn(() => ({
    to: vi.fn(() => ({
      emit: vi.fn(),
    })),
  })),
}));

import app from "../../src/app.js";
import { User } from "../../src/models/user.model.js";
import { Post } from "../../src/models/post.model.js";
import { Profile } from "../../src/models/profile.model.js";
import { Connection } from "../../src/models/connection.model.js";
import { Like } from "../../src/models/like.model.js";
import { Notification } from "../../src/models/notification.model.js";
import { CommentModel } from "../../src/models/comment.model.js";
import { generateAccessToken } from "../../src/utils/jwt.util.js";

describe("Posts", () => {

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Like.syncIndexes();
  });

  it("should create a post successfully", async () => {
    const user = await User.create({
      name: "Post Creator",
      email: "post-creator@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        text: "This is my first CollabSpace post",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data.text).toBe(
      "This is my first CollabSpace post"
    );

    expect(response.body.data.userId.toString()).toBe(
      user._id.toString()
    );

    expect(response.body.data.likeCount).toBe(0);
    expect(response.body.data.commentCount).toBe(0);
    expect(response.body.data.isDeleted).toBe(false);

    const post = await Post.findOne({ userId: user._id });

    expect(post).not.toBeNull();
    expect(post!.text).toBe("This is my first CollabSpace post");
  });

  it("should not allow an unauthenticated user to create a post", async () => {
  const response = await request(app)
    .post("/api/posts")
    .send({
      text: "This post should not be created",
    });

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);

  const postCount = await Post.countDocuments();

  expect(postCount).toBe(0);
  });

  it("should reject an empty post", async () => {
  const user = await User.create({
    name: "Post Creator",
    email: "empty-post@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      text: "   ",
    });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const postCount = await Post.countDocuments();

  expect(postCount).toBe(0);
  });

  it("should allow a post with exactly 2000 characters", async () => {
  const user = await User.create({
    name: "Post Creator",
    email: "max-post@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const text = "a".repeat(2000);

  const response = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ text });

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
  expect(response.body.data.text).toHaveLength(2000);

  const post = await Post.findOne({ userId: user._id });

  expect(post).not.toBeNull();
  expect(post!.text).toHaveLength(2000);
  });

  it("should reject a post with more than 2000 characters", async () => {
  const user = await User.create({
    name: "Post Creator",
    email: "long-post@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const text = "a".repeat(2001);

  const response = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ text });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const postCount = await Post.countDocuments();

  expect(postCount).toBe(0);
  });

  it("should allow a user to delete their own post", async () => {
  const user = await User.create({
    name: "Post Owner",
    email: "delete-post@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post to be deleted",
  });

  const response = await request(app)
    .delete(`/api/posts/${post._id}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const deletedPost = await Post.findById(post._id);

  expect(deletedPost).not.toBeNull();
  expect(deletedPost!.isDeleted).toBe(true);
  });

  it("should not allow a user to delete another user's post", async () => {
  const owner = await User.create({
    name: "Post Owner",
    email: "post-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const otherUser = await User.create({
    name: "Other User",
    email: "other-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: otherUser._id.toString(),
    role: otherUser.role,
  });

  const post = await Post.create({
    userId: owner._id,
    text: "This belongs to the owner",
  });

  const response = await request(app)
    .delete(`/api/posts/${post._id}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(403);
  expect(response.body.success).toBe(false);

  const unchangedPost = await Post.findById(post._id);

  expect(unchangedPost).not.toBeNull();
  expect(unchangedPost!.isDeleted).toBe(false);
  });

  it("should return 404 when deleting a non-existent post", async () => {
  const user = await User.create({
    name: "Post User",
    email: "missing-post@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const nonExistentPostId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .delete(`/api/posts/${nonExistentPostId}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);
  });

  it("should reject an invalid post ID when deleting", async () => {
  const user = await User.create({
    name: "Post User",
    email: "invalid-id@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .delete("/api/posts/invalid-post-id")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  });

  it("should not show deleted posts in the feed", async () => {
  const user = await User.create({
    name: "Feed User",
    email: "feed-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  await Post.create({
    userId: user._id,
    text: "Visible post",
    isDeleted: false,
  });

  await Post.create({
    userId: user._id,
    text: "Deleted post",
    isDeleted: true,
  });

  const response = await request(app)
    .get("/api/posts/feed")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const posts = response.body.data.posts;

  expect(posts).toHaveLength(1);
  expect(posts[0].text).toBe("Visible post");
  expect(posts[0].isDeleted).toBe(false);
  });

  it("should return feed posts with correct pagination", async () => {
  const user = await User.create({
    name: "Feed User",
    email: "pagination-feed@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  await Post.create([
    { userId: user._id, text: "Post 1" },
    { userId: user._id, text: "Post 2" },
    { userId: user._id, text: "Post 3" },
  ]);

  const response = await request(app)
    .get("/api/posts/feed?page=1&limit=2")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const { posts, pagination } = response.body.data;

  expect(posts).toHaveLength(2);
  expect(pagination.page).toBe(1);
  expect(pagination.limit).toBe(2);
  expect(pagination.total).toBe(3);
  expect(pagination.hasMore).toBe(true);
  });

  it("should return the second page of feed posts correctly", async () => {
  const user = await User.create({
    name: "Feed User",
    email: "pagination-page2@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  await Post.create([
    { userId: user._id, text: "Post 1" },
    { userId: user._id, text: "Post 2" },
    { userId: user._id, text: "Post 3" },
  ]);

  const response = await request(app)
    .get("/api/posts/feed?page=2&limit=2")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const { posts, pagination } = response.body.data;

  expect(posts).toHaveLength(1);
  expect(pagination.page).toBe(2);
  expect(pagination.limit).toBe(2);
  expect(pagination.total).toBe(3);
  expect(pagination.hasMore).toBe(false);
  });

  it("should return newest posts first in the feed", async () => {
  const user = await User.create({
    name: "Feed User",
    email: "ordering-feed@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const oldPost = await Post.create({
    userId: user._id,
    text: "Older post",
    createdAt: new Date("2026-01-01"),
  });

  const newPost = await Post.create({
    userId: user._id,
    text: "Newer post",
    createdAt: new Date("2026-01-02"),
  });

  const response = await request(app)
    .get("/api/posts/feed")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);

  const posts = response.body.data.posts;

  expect(posts).toHaveLength(2);
  expect(posts[0]._id).toBe(newPost._id.toString());
  expect(posts[1]._id).toBe(oldPost._id.toString());
  });

  it("should not allow an unauthenticated user to access the feed", async () => {
  const response = await request(app)
    .get("/api/posts/feed");

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
  });

  it("should return user's own posts", async () => {
  const user = await User.create({
    name: "Post User",
    email: "my-posts@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  await Post.create([
    {
      userId: user._id,
      text: "My first post",
    },
    {
      userId: user._id,
      text: "My second post",
    },
  ]);

  const response = await request(app)
    .get(`/api/posts/user/${user._id}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const { posts, pagination } = response.body.data;

  expect(posts).toHaveLength(2);
  expect(pagination.total).toBe(2);

expect(posts.every((post: any) =>
    post.userId._id.toString() === user._id.toString()
  )).toBe(true);
  });

  it("should allow viewing another user's posts when their profile is public", async () => {
  const owner = await User.create({
    name: "Post Owner",
    email: "public-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const viewer = await User.create({
    name: "Viewer",
    email: "public-viewer@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Profile.create({
    userId: owner._id,
    isPublic: true,
  });

  const accessToken = generateAccessToken({
    userId: viewer._id.toString(),
    role: viewer.role,
  });

  await Post.create({
    userId: owner._id,
    text: "Public profile post",
  });

  const response = await request(app)
    .get(`/api/posts/user/${owner._id}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const posts = response.body.data.posts;

  expect(posts).toHaveLength(1);
  expect(posts[0].text).toBe("Public profile post");
  expect(posts[0].userId._id.toString()).toBe(owner._id.toString());
  });

  it("should not allow a non-connected user to view posts of a private profile", async () => {
  const owner = await User.create({
    name: "Private Owner",
    email: "private-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const viewer = await User.create({
    name: "Non Connected Viewer",
    email: "private-viewer@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Profile.create({
    userId: owner._id,
    isPublic: false,
  });

  const accessToken = generateAccessToken({
    userId: viewer._id.toString(),
    role: viewer.role,
  });

  await Post.create({
    userId: owner._id,
    text: "Private post",
  });

  const response = await request(app)
    .get(`/api/posts/user/${owner._id}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(403);
  expect(response.body.success).toBe(false);

  const posts = await Post.find({ userId: owner._id });

  expect(posts).toHaveLength(1);
  expect(posts[0].isDeleted).toBe(false);
  });

  it("should allow a connected user to view posts of a private profile", async () => {
  const owner = await User.create({
    name: "Private Owner",
    email: "connected-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const viewer = await User.create({
    name: "Connected Viewer",
    email: "connected-viewer@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Profile.create({
    userId: owner._id,
    isPublic: false,
  });

  await Connection.create({
    senderId: viewer._id,
    receiverId: owner._id,
    status: "accepted",
  });

  const accessToken = generateAccessToken({
    userId: viewer._id.toString(),
    role: viewer.role,
  });

  await Post.create({
    userId: owner._id,
    text: "Private post visible to connection",
  });

  const response = await request(app)
    .get(`/api/posts/user/${owner._id}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const posts = response.body.data.posts;

  expect(posts).toHaveLength(1);
  expect(posts[0].text).toBe("Private post visible to connection");
  expect(posts[0].userId._id.toString()).toBe(owner._id.toString());
  });

  it("should not show deleted posts in user's posts", async () => {
  const user = await User.create({
    name: "Post Owner",
    email: "user-deleted-post@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  await Post.create([
    {
      userId: user._id,
      text: "Visible user post",
      isDeleted: false,
    },
    {
      userId: user._id,
      text: "Deleted user post",
      isDeleted: true,
    },
  ]);

  const response = await request(app)
    .get(`/api/posts/user/${user._id}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const posts = response.body.data.posts;

  expect(posts).toHaveLength(1);
  expect(posts[0].text).toBe("Visible user post");
  expect(posts[0].isDeleted).toBe(false);
  });

  it("should reject an invalid user ID when fetching user posts", async () => {
  const user = await User.create({
    name: "Post User",
    email: "invalid-user-id@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .get("/api/posts/user/invalid-user-id")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  });

  it("should return empty posts for a valid but non-existent user ID", async () => {
  const viewer = await User.create({
    name: "Viewer",
    email: "non-existent-target@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: viewer._id.toString(),
    role: viewer.role,
  });

  const nonExistentUserId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .get(`/api/posts/user/${nonExistentUserId}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  expect(response.body.data.posts).toHaveLength(0);
  expect(response.body.data.pagination.total).toBe(0);
  });

  it("should not allow an unauthenticated user to view user posts", async () => {
  const user = await User.create({
    name: "Post Owner",
    email: "unauth-user-posts@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Post.create({
    userId: user._id,
    text: "Private content",
  });

  const response = await request(app)
    .get(`/api/posts/user/${user._id}`);

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
  });

  it("should paginate user-specific posts", async () => {
  const user = await User.create({
    name: "Pagination User",
    email: "user-pagination@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Post.create([
    { userId: user._id, text: "Post 1" },
    { userId: user._id, text: "Post 2" },
    { userId: user._id, text: "Post 3" },
  ]);

  const page1 = await request(app)
    .get(`/api/posts/user/${user._id}?page=1&limit=2`)
    .set("Authorization", `Bearer ${generateAccessToken({userId: user._id.toString(), role: "user"})}`);

  expect(page1.status).toBe(200);
  expect(page1.body.data.posts).toHaveLength(2);
  expect(page1.body.data.pagination.hasMore).toBe(true);

  const page2 = await request(app)
    .get(`/api/posts/user/${user._id}?page=2&limit=2`)
    .set("Authorization", `Bearer ${generateAccessToken({userId: user._id.toString(), role: "user"})}`);

  expect(page2.status).toBe(200);
  expect(page2.body.data.posts).toHaveLength(1);
  expect(page2.body.data.pagination.hasMore).toBe(false);
  });

  it("should return user posts newest first", async () => {
  const user = await User.create({
    name: "Order User",
    email: "user-order@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post1 = await Post.create({
    userId: user._id,
    text: "Oldest post",
  });

  await new Promise((resolve) => setTimeout(resolve, 10));

  const post2 = await Post.create({
    userId: user._id,
    text: "Newest post",
  });

  const response = await request(app)
    .get(`/api/posts/user/${user._id}`)
    .set(
      "Authorization",
      `Bearer ${generateAccessToken({
        userId: user._id.toString(),
        role: "user",
      })}`
    );

  expect(response.status).toBe(200);

  const posts = response.body.data.posts;

  expect(posts[0]._id).toBe(post2._id.toString());
  expect(posts[1]._id).toBe(post1._id.toString());
  });

  it("should allow viewing posts when target user has no profile", async () => {
  const owner = await User.create({
    name: "No Profile User",
    email: "no-profile@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Post.create({
    userId: owner._id,
    text: "Post without profile",
  });

  const viewer = await User.create({
    name: "Viewer User",
    email: "no-profile-viewer@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const response = await request(app)
    .get(`/api/posts/user/${owner._id}`)
    .set(
      "Authorization",
      `Bearer ${generateAccessToken({
        userId: viewer._id.toString(),
        role: "user",
      })}`
    );

  expect(response.status).toBe(200);
  expect(response.body.data.posts).toHaveLength(1);
  expect(response.body.data.posts[0].text).toBe("Post without profile");
  });

  it("should allow a user to view their own posts even when their profile is private", async () => {
  const user = await User.create({
    name: "Private Owner",
    email: "private-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Profile.create({
    userId: user._id,
    isPublic: false,
  });

  await Post.create({
    userId: user._id,
    text: "My private post",
  });

  const response = await request(app)
    .get(`/api/posts/user/${user._id}`)
    .set(
      "Authorization",
      `Bearer ${generateAccessToken({
        userId: user._id.toString(),
        role: "user",
      })}`
    );

  expect(response.status).toBe(200);
  expect(response.body.data.posts).toHaveLength(1);
  expect(response.body.data.posts[0].text).toBe("My private post");
  });

  it("should allow a user to like a post", async () => {
  const user = await User.create({
    name: "Like User",
    email: "like-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post to like",
  });

  const response = await request(app)
    .post(`/api/posts/${post._id}/like`)
    .set(
      "Authorization",
      `Bearer ${generateAccessToken({
        userId: user._id.toString(),
        role: "user",
      })}`
    );

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const updatedPost = await Post.findById(post._id);
  const like = await Like.findOne({
    userId: user._id,
    postId: post._id,
  });

  expect(updatedPost?.likeCount).toBe(1);
  expect(like).not.toBeNull();
  });

  it("should not allow a user to like the same post twice", async () => {
  const user = await User.create({
    name: "Duplicate Like User",
    email: "duplicate-like@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for duplicate like",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const firstLike = await request(app)
    .post(`/api/posts/${post._id}/like`)
    .set("Authorization", `Bearer ${token}`);

  expect(firstLike.status).toBe(200);

  const secondLike = await request(app)
    .post(`/api/posts/${post._id}/like`)
    .set("Authorization", `Bearer ${token}`);

  expect(secondLike.status).toBe(409);
  expect(secondLike.body.success).toBe(false);

  const updatedPost = await Post.findById(post._id);
  const likeCount = await Like.countDocuments({
    userId: user._id,
    postId: post._id,
  });

  expect(updatedPost?.likeCount).toBe(1);
  expect(likeCount).toBe(1);
  });

  it("should not allow a user to like a non-existent post", async () => {
  const user = await User.create({
    name: "Missing Post User",
    email: "missing-post-like@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const fakePostId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .post(`/api/posts/${fakePostId}/like`)
    .set(
      "Authorization",
      `Bearer ${generateAccessToken({
        userId: user._id.toString(),
        role: "user",
      })}`
    );

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);

  const likeCount = await Like.countDocuments({
    userId: user._id,
    postId: fakePostId,
  });

  expect(likeCount).toBe(0);
  });

  it("should not allow an unauthenticated user to like a post", async () => {
  const user = await User.create({
    name: "Post Owner",
    email: "unauth-like-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post requiring authentication",
  });

  const response = await request(app)
    .post(`/api/posts/${post._id}/like`);

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);

  const updatedPost = await Post.findById(post._id);
  const likeCount = await Like.countDocuments({
    postId: post._id,
  });

  expect(updatedPost?.likeCount).toBe(0);
  expect(likeCount).toBe(0);
  });

  it("should allow self-like without creating a notification", async () => {
  const user = await User.create({
    name: "Self Like User",
    email: "self-like@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "My own post",
  });

  const response = await request(app)
    .post(`/api/posts/${post._id}/like`)
    .set(
      "Authorization",
      `Bearer ${generateAccessToken({
        userId: user._id.toString(),
        role: "user",
      })}`
    );

  expect(response.status).toBe(200);

  const updatedPost = await Post.findById(post._id);
  const like = await Like.findOne({
    userId: user._id,
    postId: post._id,
  });
  const notificationCount = await Notification.countDocuments({
    receiverId: user._id,
    type: "post_liked",
  });

  expect(updatedPost?.likeCount).toBe(1);
  expect(like).not.toBeNull();
  expect(notificationCount).toBe(0);
  });

  it("should create a notification when another user likes a post", async () => {
  const owner = await User.create({
    name: "Post Owner",
    email: "like-notification-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const liker = await User.create({
    name: "Post Liker",
    email: "like-notification-liker@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: owner._id,
    text: "Post that will receive a like",
  });

  const response = await request(app)
    .post(`/api/posts/${post._id}/like`)
    .set(
      "Authorization",
      `Bearer ${generateAccessToken({
        userId: liker._id.toString(),
        role: "user",
      })}`
    );

  console.log(response.body);

  expect(response.status).toBe(200);

  const notification = await Notification.findOne({
    receiverId: owner._id,
    senderId: liker._id,
    type: "post_liked",
    refId: post._id,
    refModel: "Post",
  });

  expect(notification).not.toBeNull();
  expect(notification?.message).toBe("liked your post");

  const updatedPost = await Post.findById(post._id);
  expect(updatedPost?.likeCount).toBe(1);
  });

  it("should unlike a post and decrease like count", async () => {
  const owner = await User.create({
    name: "Post Owner",
    email: "unlike-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const liker = await User.create({
    name: "Post Liker",
    email: "unlike-liker@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: owner._id,
    text: "Post to unlike",
  });

  const token = generateAccessToken({
    userId: liker._id.toString(),
    role: "user",
  });

  // Like first
  const likeResponse = await request(app)
    .post(`/api/posts/${post._id}/like`)
    .set("Authorization", `Bearer ${token}`);

  expect(likeResponse.status).toBe(200);

  // Then unlike
  const unlikeResponse = await request(app)
    .delete(`/api/posts/${post._id}/like`)
    .set("Authorization", `Bearer ${token}`);

  expect(unlikeResponse.status).toBe(200);

  // Like document should be removed
  const like = await Like.findOne({
    userId: liker._id,
    postId: post._id,
  });

  expect(like).toBeNull();

  // Post count should return to 0
  const updatedPost = await Post.findById(post._id);

  expect(updatedPost?.likeCount).toBe(0);
  });

  it("should not allow a user to unlike another user's like", async () => {
  const owner = await User.create({
    name: "Post Owner",
    email: "unlike-auth-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const liker = await User.create({
    name: "Original Liker",
    email: "unlike-auth-liker@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const attacker = await User.create({
    name: "Other User",
    email: "unlike-auth-attacker@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: owner._id,
    text: "Protected like",
  });

  const likerToken = generateAccessToken({
    userId: liker._id.toString(),
    role: "user",
  });

  const attackerToken = generateAccessToken({
    userId: attacker._id.toString(),
    role: "user",
  });

  // Original user likes the post
  const likeResponse = await request(app)
    .post(`/api/posts/${post._id}/like`)
    .set("Authorization", `Bearer ${likerToken}`);

  expect(likeResponse.status).toBe(200);

  // Different user tries to unlike it
  const unlikeResponse = await request(app)
    .delete(`/api/posts/${post._id}/like`)
    .set("Authorization", `Bearer ${attackerToken}`);

  expect(unlikeResponse.status).toBe(404);

  // Original Like must remain
  const like = await Like.findOne({
    userId: liker._id,
    postId: post._id,
  });

  expect(like).not.toBeNull();

  // Count must remain unchanged
  const updatedPost = await Post.findById(post._id);

  expect(updatedPost?.likeCount).toBe(1);
  });

  it("should not allow liking a deleted post", async () => {
  const owner = await User.create({
    name: "Post Owner",
    email: "deleted-like-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const liker = await User.create({
    name: "Post Liker",
    email: "deleted-like-liker@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: owner._id,
    text: "Deleted post",
    isDeleted: true,
  });

  const token = generateAccessToken({
    userId: liker._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post(`/api/posts/${post._id}/like`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(404);

  const like = await Like.findOne({
    userId: liker._id,
    postId: post._id,
  });

  expect(like).toBeNull();

  const unchangedPost = await Post.findById(post._id);

  expect(unchangedPost?.likeCount).toBe(0);
  });

  it("should create a comment on a post", async () => {
  const user = await User.create({
    name: "Comment User",
    email: "comment-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for commenting",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post(`/api/posts/${post._id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      text: "This is my first comment",
    });

  expect(response.status).toBe(201);

  expect(response.body.success).toBe(true);
  expect(response.body.data.text).toBe("This is my first comment");
  expect(response.body.data.postId.toString()).toBe(post._id.toString());
  expect(response.body.data.userId._id.toString()).toBe(user._id.toString());
  expect(response.body.data.parentCommentId).toBeNull();

  const comment = await CommentModel.findOne({
    postId: post._id,
    userId: user._id,
  });

  expect(comment).not.toBeNull();
  expect(comment?.text).toBe("This is my first comment");

  const updatedPost = await Post.findById(post._id);

  expect(updatedPost?.commentCount).toBe(1);
  });

  it("should reject an empty comment", async () => {
  const user = await User.create({
    name: "Comment User",
    email: "empty-comment@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for validation",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post(`/api/posts/${post._id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      text: "   ",
    });

  expect(response.status).toBe(400);

  const commentCount = await CommentModel.countDocuments({
    postId: post._id,
  });

  expect(commentCount).toBe(0);

  const updatedPost = await Post.findById(post._id);

  expect(updatedPost?.commentCount).toBe(0);
  });

  it("should allow a comment with exactly 500 characters", async () => {
  const user = await User.create({
    name: "Comment User",
    email: "max-comment@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for max comment",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const text = "a".repeat(500);

  const response = await request(app)
    .post(`/api/posts/${post._id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ text });

  expect(response.status).toBe(201);
  expect(response.body.data.text).toBe(text);

  const comment = await CommentModel.findOne({
    postId: post._id,
  });

  expect(comment).not.toBeNull();
  expect(comment?.text.length).toBe(500);

  const updatedPost = await Post.findById(post._id);

  expect(updatedPost?.commentCount).toBe(1);
  });

  it("should reject a comment with more than 500 characters", async () => {
  const user = await User.create({
    name: "Comment User",
    email: "too-long-comment@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for long comment",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const text = "a".repeat(501);

  const response = await request(app)
    .post(`/api/posts/${post._id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ text });

  expect(response.status).toBe(400);

  const comment = await CommentModel.findOne({
    postId: post._id,
  });

  expect(comment).toBeNull();

  const updatedPost = await Post.findById(post._id);

  expect(updatedPost?.commentCount).toBe(0);
  });

  it("should not allow an unauthenticated user to create a comment", async () => {
  const user = await User.create({
    name: "Post Owner",
    email: "unauth-comment-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Protected comment post",
  });

  const response = await request(app)
    .post(`/api/posts/${post._id}/comments`)
    .send({
      text: "Unauthorized comment",
    });

  expect(response.status).toBe(401);

  const comment = await CommentModel.findOne({
    postId: post._id,
  });

  expect(comment).toBeNull();

  const unchangedPost = await Post.findById(post._id);

  expect(unchangedPost?.commentCount).toBe(0);
  });

  it("should not allow commenting on a non-existent post", async () => {
  const user = await User.create({
    name: "Comment User",
    email: "missing-post-comment@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const nonExistentPostId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .post(`/api/posts/${nonExistentPostId}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      text: "Comment on missing post",
    });

  expect(response.status).toBe(404);

  const comment = await CommentModel.findOne({
    userId: user._id,
  });

  expect(comment).toBeNull();
  });

  it("should not allow commenting on a deleted post", async () => {
  const user = await User.create({
    name: "Comment User",
    email: "deleted-post-comment@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Deleted post",
    isDeleted: true,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post(`/api/posts/${post._id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      text: "Comment on deleted post",
    });

  expect(response.status).toBe(404);

  const comment = await CommentModel.findOne({
    postId: post._id,
  });

  expect(comment).toBeNull();

  const unchangedPost = await Post.findById(post._id);

  expect(unchangedPost?.commentCount).toBe(0);
  });

  it("should create a reply to a comment", async () => {
  const user = await User.create({
    name: "Comment User",
    email: "reply-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for replies",
  });

  const parentComment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Original comment",
    parentCommentId: null,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post(`/api/posts/${post._id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      text: "This is a reply",
      parentCommentId: parentComment._id.toString(),
    });

  expect(response.status).toBe(201);

  expect(response.body.data.text).toBe("This is a reply");
  expect(response.body.data.parentCommentId.toString()).toBe(
    parentComment._id.toString()
  );

  const reply = await CommentModel.findOne({
    postId: post._id,
    parentCommentId: parentComment._id,
  });

  expect(reply).not.toBeNull();
  expect(reply?.text).toBe("This is a reply");

  const updatedPost = await Post.findById(post._id);

  expect(updatedPost?.commentCount).toBe(1);
  });

  it("should not allow a reply to a non-existent parent comment", async () => {
  const user = await User.create({
    name: "Reply User",
    email: "invalid-parent@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for invalid reply",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const nonExistentCommentId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .post(`/api/posts/${post._id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      text: "Invalid reply",
      parentCommentId: nonExistentCommentId.toString(),
    });

  expect(response.status).toBe(404);

  const comment = await CommentModel.findOne({
    postId: post._id,
  });

  expect(comment).toBeNull();

  const unchangedPost = await Post.findById(post._id);

  expect(unchangedPost?.commentCount).toBe(0);
  });

  it("should not allow a reply to a comment from another post", async () => {
  const user = await User.create({
    name: "Reply User",
    email: "cross-post-reply@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const postA = await Post.create({
    userId: user._id,
    text: "First post",
  });

  const postB = await Post.create({
    userId: user._id,
    text: "Second post",
  });

  const parentComment = await CommentModel.create({
    postId: postA._id,
    userId: user._id,
    text: "Comment belongs to post A",
    parentCommentId: null,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post(`/api/posts/${postB._id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      text: "Invalid cross-post reply",
      parentCommentId: parentComment._id.toString(),
    });

  expect(response.status).toBe(404);

  const commentsOnPostB = await CommentModel.find({
    postId: postB._id,
  });

  expect(commentsOnPostB).toHaveLength(0);

  const updatedPostB = await Post.findById(postB._id);

  expect(updatedPostB?.commentCount).toBe(0);
  });

  it("should not allow a reply to a deleted comment", async () => {
  const user = await User.create({
    name: "Reply User",
    email: "deleted-parent@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for deleted parent",
  });

  const parentComment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Deleted parent comment",
    parentCommentId: null,
    isDeleted: true,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post(`/api/posts/${post._id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      text: "Reply to deleted comment",
      parentCommentId: parentComment._id.toString(),
    });

  expect(response.status).toBe(404);

  const reply = await CommentModel.findOne({
    postId: post._id,
    parentCommentId: parentComment._id,
  });

  expect(reply).toBeNull();

  const updatedPost = await Post.findById(post._id);

  expect(updatedPost?.commentCount).toBe(0);
  });

  it("should not allow replying to a reply", async () => {
  const user = await User.create({
    name: "Reply User",
    email: "nested-reply@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for nested replies",
  });

  const parentComment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Top-level comment",
    parentCommentId: null,
  });

  const reply = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "First-level reply",
    parentCommentId: parentComment._id,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .post(`/api/posts/${post._id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      text: "Reply to reply",
      parentCommentId: reply._id.toString(),
    });

  expect(response.status).toBe(400);

  expect(response.body.message).toBe(
    "Cannot reply to a reply - only one level of nesting is allowed"
  );

  const nestedReply = await CommentModel.findOne({
    postId: post._id,
    parentCommentId: reply._id,
  });

  expect(nestedReply).toBeNull();

  const updatedPost = await Post.findById(post._id);

  expect(updatedPost?.commentCount).toBe(0);
  });

  it("should get top-level comments of a post", async () => {
  const user = await User.create({
    name: "Comment User",
    email: "get-comments@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post with comments",
  });

  await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "First comment",
    parentCommentId: null,
  });

  await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Second comment",
    parentCommentId: null,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/posts/${post._id}/comments`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data.comments).toHaveLength(2);
  expect(response.body.data.pagination.total).toBe(2);

  expect(
    response.body.data.comments.every(
      (comment: any) =>
        comment.postId.toString() === post._id.toString()
    )
  ).toBe(true);

  expect(
    response.body.data.comments.every(
      (comment: any) => comment.parentCommentId === null
    )
  ).toBe(true);

  expect(
    response.body.data.comments.every(
      (comment: any) =>
        comment.userId._id.toString() === user._id.toString()
    )
  ).toBe(true);
  });

  it("should not include replies in top-level post comments", async () => {
  const user = await User.create({
    name: "Comment User",
    email: "top-level-only@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post with nested comments",
  });

  const parentComment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Top-level comment",
    parentCommentId: null,
  });

  await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Reply comment",
    parentCommentId: parentComment._id,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/posts/${post._id}/comments`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.comments).toHaveLength(1);
  expect(response.body.data.comments[0].text).toBe(
    "Top-level comment"
  );

  expect(response.body.data.pagination.total).toBe(1);
  });

  it("should get replies of a comment", async () => {
  const user = await User.create({
    name: "Reply User",
    email: "replies@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post with replies",
  });

  const parentComment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Parent comment",
    parentCommentId: null,
  });

  await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Reply 1",
    parentCommentId: parentComment._id,
  });

  await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Reply 2",
    parentCommentId: parentComment._id,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/comments/${parentComment._id}/replies`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.replies).toHaveLength(2);
  expect(response.body.data.pagination.total).toBe(2);

  expect(
    response.body.data.replies.every(
      (reply: any) =>
        reply.parentCommentId.toString() === parentComment._id.toString()
    )
  ).toBe(true);
  });

  it("should not return replies belonging to another comment", async () => {
  const user = await User.create({
    name: "Reply User",
    email: "another-reply@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post with multiple comments",
  });

  const commentA = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Comment A",
    parentCommentId: null,
  });

  const commentB = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Comment B",
    parentCommentId: null,
  });

  await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Reply to A",
    parentCommentId: commentA._id,
  });

  await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Reply to B",
    parentCommentId: commentB._id,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/comments/${commentA._id}/replies`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.replies).toHaveLength(1);
  expect(response.body.data.replies[0].text).toBe("Reply to A");
  expect(response.body.data.pagination.total).toBe(1);
  });

  it("should paginate comment replies", async () => {
  const user = await User.create({
    name: "Pagination User",
    email: "reply-pagination@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for reply pagination",
  });

  const parentComment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Parent comment",
    parentCommentId: null,
  });

  await CommentModel.create([
    {
      postId: post._id,
      userId: user._id,
      text: "Reply 1",
      parentCommentId: parentComment._id,
    },
    {
      postId: post._id,
      userId: user._id,
      text: "Reply 2",
      parentCommentId: parentComment._id,
    },
    {
      postId: post._id,
      userId: user._id,
      text: "Reply 3",
      parentCommentId: parentComment._id,
    },
  ]);

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/comments/${parentComment._id}/replies?page=1&limit=2`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.replies).toHaveLength(2);
  expect(response.body.data.pagination.page).toBe(1);
  expect(response.body.data.pagination.limit).toBe(2);
  expect(response.body.data.pagination.total).toBe(3);
  expect(response.body.data.pagination.hasMore).toBe(true);
  });

  it("should return the second page of comment replies correctly", async () => {
  const user = await User.create({
    name: "Reply Page User",
    email: "reply-page2@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for reply page 2",
  });

  const parentComment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Parent comment",
    parentCommentId: null,
  });

  await CommentModel.create([
    {
      postId: post._id,
      userId: user._id,
      text: "Reply 1",
      parentCommentId: parentComment._id,
    },
    {
      postId: post._id,
      userId: user._id,
      text: "Reply 2",
      parentCommentId: parentComment._id,
    },
    {
      postId: post._id,
      userId: user._id,
      text: "Reply 3",
      parentCommentId: parentComment._id,
    },
  ]);

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/comments/${parentComment._id}/replies?page=2&limit=2`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.replies).toHaveLength(1);
  expect(response.body.data.replies[0].text).toBe("Reply 1");
  expect(response.body.data.pagination.page).toBe(2);
  expect(response.body.data.pagination.limit).toBe(2);
  expect(response.body.data.pagination.total).toBe(3);
  expect(response.body.data.pagination.hasMore).toBe(false);
  });

  it("should not include deleted comments in top-level post comments", async () => {
  const user = await User.create({
    name: "Deleted Comment User",
    email: "deleted-comment@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post with deleted comment",
  });

  const activeComment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Active comment",
    parentCommentId: null,
    isDeleted: false,
  });

  await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Deleted comment",
    parentCommentId: null,
    isDeleted: true,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/posts/${post._id}/comments`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.comments).toHaveLength(1);
  expect(response.body.data.comments[0].text).toBe("Active comment");
  expect(response.body.data.pagination.total).toBe(1);
  });

  it("should not include deleted replies", async () => {
  const user = await User.create({
    name: "Deleted Reply User",
    email: "deleted-reply@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post with deleted reply",
  });

  const parentComment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Parent comment",
    parentCommentId: null,
  });

  await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Active reply",
    parentCommentId: parentComment._id,
    isDeleted: false,
  });

  await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Deleted reply",
    parentCommentId: parentComment._id,
    isDeleted: true,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/comments/${parentComment._id}/replies`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.replies).toHaveLength(1);
  expect(response.body.data.replies[0].text).toBe("Active reply");
  expect(response.body.data.pagination.total).toBe(1);
  });

  it("should allow a user to delete their own comment", async () => {
  const user = await User.create({
    name: "Delete Comment User",
    email: "delete-own-comment@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for comment deletion",
    commentCount: 1,
  });

  const comment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Comment to delete",
    parentCommentId: null,
    isDeleted: false,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .delete(`/api/comments/${comment._id}`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe("Comment deleted");

  const deletedComment = await CommentModel.findById(comment._id);
  expect(deletedComment).not.toBeNull();
  expect(deletedComment!.isDeleted).toBe(true);

  const updatedPost = await Post.findById(post._id);
  expect(updatedPost!.commentCount).toBe(0);
  });

  it("should not allow a user to delete another user's comment", async () => {
  const owner = await User.create({
    name: "Comment Owner",
    email: "comment-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const otherUser = await User.create({
    name: "Other User",
    email: "other-comment-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: owner._id,
    text: "Post with another user's comment",
    commentCount: 1,
  });

  const comment = await CommentModel.create({
    postId: post._id,
    userId: owner._id,
    text: "Owner's comment",
    parentCommentId: null,
    isDeleted: false,
  });

  const token = generateAccessToken({
    userId: otherUser._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .delete(`/api/comments/${comment._id}`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(403);

  const unchangedComment = await CommentModel.findById(comment._id);
  expect(unchangedComment).not.toBeNull();
  expect(unchangedComment!.isDeleted).toBe(false);

  const unchangedPost = await Post.findById(post._id);
  expect(unchangedPost!.commentCount).toBe(1);
  });

  it("should not allow an unauthenticated user to delete a comment", async () => {
  const user = await User.create({
    name: "Unauthenticated Delete User",
    email: "unauth-delete-comment@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for unauthenticated delete",
    commentCount: 1,
  });

  const comment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Protected comment",
    parentCommentId: null,
    isDeleted: false,
  });

  const response = await request(app)
    .delete(`/api/comments/${comment._id}`);

  expect(response.status).toBe(401);

  const unchangedComment = await CommentModel.findById(comment._id);
  expect(unchangedComment).not.toBeNull();
  expect(unchangedComment!.isDeleted).toBe(false);

  const unchangedPost = await Post.findById(post._id);
  expect(unchangedPost!.commentCount).toBe(1);
  });

  it("should return 404 when deleting a non-existent comment", async () => {
  const user = await User.create({
    name: "Missing Comment User",
    email: "missing-comment@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const nonExistentCommentId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .delete(`/api/comments/${nonExistentCommentId}`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("Comment not found");
  });

  it("should reject an invalid comment ID when deleting", async () => {
  const user = await User.create({
    name: "Invalid Comment ID User",
    email: "invalid-comment-id@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .delete("/api/comments/invalid-comment-id")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(400);
  });

  it("should not allow deleting an already deleted comment", async () => {
  const user = await User.create({
    name: "Already Deleted User",
    email: "already-deleted-comment@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post with deleted comment",
    commentCount: 1,
  });

  const comment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Comment to delete twice",
    parentCommentId: null,
    isDeleted: false,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const firstResponse = await request(app)
    .delete(`/api/comments/${comment._id}`)
    .set("Authorization", `Bearer ${token}`);

  expect(firstResponse.status).toBe(200);

  const secondResponse = await request(app)
    .delete(`/api/comments/${comment._id}`)
    .set("Authorization", `Bearer ${token}`);

  expect(secondResponse.status).toBe(400);
  expect(secondResponse.body.message).toBe("Comment already deleted");

  const deletedComment = await CommentModel.findById(comment._id);
  expect(deletedComment!.isDeleted).toBe(true);

  const updatedPost = await Post.findById(post._id);
  expect(updatedPost!.commentCount).toBe(0);
  });

  it("should allow a user to delete their own reply", async () => {
  const user = await User.create({
    name: "Delete Reply User",
    email: "delete-own-reply@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post with reply",
    commentCount: 2,
  });

  const parentComment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Parent comment",
    parentCommentId: null,
    isDeleted: false,
  });

  const reply = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Reply to delete",
    parentCommentId: parentComment._id,
    isDeleted: false,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .delete(`/api/comments/${reply._id}`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe("Comment deleted");

  const deletedReply = await CommentModel.findById(reply._id);

  expect(deletedReply).not.toBeNull();
  expect(deletedReply!.isDeleted).toBe(true);

  const updatedPost = await Post.findById(post._id);

  expect(updatedPost!.commentCount).toBe(1);
  });

  it("should not allow a user to delete another user's reply", async () => {
  const owner = await User.create({
    name: "Reply Owner",
    email: "reply-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const otherUser = await User.create({
    name: "Reply Other User",
    email: "reply-other-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: owner._id,
    text: "Post with protected reply",
    commentCount: 2,
  });

  const parentComment = await CommentModel.create({
    postId: post._id,
    userId: owner._id,
    text: "Parent comment",
    parentCommentId: null,
    isDeleted: false,
  });

  const reply = await CommentModel.create({
    postId: post._id,
    userId: owner._id,
    text: "Protected reply",
    parentCommentId: parentComment._id,
    isDeleted: false,
  });

  const token = generateAccessToken({
    userId: otherUser._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .delete(`/api/comments/${reply._id}`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(403);

  const unchangedReply = await CommentModel.findById(reply._id);

  expect(unchangedReply).not.toBeNull();
  expect(unchangedReply!.isDeleted).toBe(false);

  const unchangedPost = await Post.findById(post._id);

  expect(unchangedPost!.commentCount).toBe(2);
  });

  it("should not delete replies when a parent comment is deleted", async () => {
  const user = await User.create({
    name: "Parent Delete User",
    email: "parent-delete@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post with parent and reply",
    commentCount: 2,
  });

  const parentComment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Parent comment",
    parentCommentId: null,
    isDeleted: false,
  });

  const reply = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Reply to parent",
    parentCommentId: parentComment._id,
    isDeleted: false,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .delete(`/api/comments/${parentComment._id}`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  const deletedParent = await CommentModel.findById(parentComment._id);
  const existingReply = await CommentModel.findById(reply._id);

  expect(deletedParent!.isDeleted).toBe(true);
  expect(existingReply).not.toBeNull();
  expect(existingReply!.isDeleted).toBe(false);

  const updatedPost = await Post.findById(post._id);
  expect(updatedPost!.commentCount).toBe(1);
  });

  it("should paginate top-level post comments", async () => {
  const user = await User.create({
    name: "Comment Pagination User",
    email: "comment-pagination@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for comment pagination",
  });

  await CommentModel.create([
    {
      postId: post._id,
      userId: user._id,
      text: "Comment 1",
      parentCommentId: null,
      isDeleted: false,
    },
    {
      postId: post._id,
      userId: user._id,
      text: "Comment 2",
      parentCommentId: null,
      isDeleted: false,
    },
    {
      postId: post._id,
      userId: user._id,
      text: "Comment 3",
      parentCommentId: null,
      isDeleted: false,
    },
  ]);

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/posts/${post._id}/comments?page=1&limit=2`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.comments).toHaveLength(2);
  expect(response.body.data.pagination.page).toBe(1);
  expect(response.body.data.pagination.limit).toBe(2);
  expect(response.body.data.pagination.total).toBe(3);
  expect(response.body.data.pagination.hasMore).toBe(true);
  });

  it("should return the second page of top-level post comments correctly", async () => {
  const user = await User.create({
    name: "Comment Page User",
    email: "comment-page2@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for comment page 2",
  });

  await CommentModel.create([
    {
      postId: post._id,
      userId: user._id,
      text: "Comment 1",
      parentCommentId: null,
      isDeleted: false,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
    },
    {
      postId: post._id,
      userId: user._id,
      text: "Comment 2",
      parentCommentId: null,
      isDeleted: false,
      createdAt: new Date("2026-01-01T10:01:00.000Z"),
    },
    {
      postId: post._id,
      userId: user._id,
      text: "Comment 3",
      parentCommentId: null,
      isDeleted: false,
      createdAt: new Date("2026-01-01T10:02:00.000Z"),
    },
  ]);

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/posts/${post._id}/comments?page=2&limit=2`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.comments).toHaveLength(1);
  expect(response.body.data.comments[0].text).toBe("Comment 1");

  expect(response.body.data.pagination.page).toBe(2);
  expect(response.body.data.pagination.limit).toBe(2);
  expect(response.body.data.pagination.total).toBe(3);
  expect(response.body.data.pagination.hasMore).toBe(false);
  });

  it("should return an empty page when there are no more top-level comments", async () => {
  const user = await User.create({
    name: "Empty Comment Page User",
    email: "empty-comment-page@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for empty comment page",
  });

  await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Only comment",
    parentCommentId: null,
    isDeleted: false,
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/posts/${post._id}/comments?page=2&limit=1`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(200);

  expect(response.body.data.comments).toHaveLength(0);
  expect(response.body.data.pagination.page).toBe(2);
  expect(response.body.data.pagination.limit).toBe(1);
  expect(response.body.data.pagination.total).toBe(1);
  expect(response.body.data.pagination.hasMore).toBe(false);
  });

  it("should reject an invalid post ID when fetching comments", async () => {
  const user = await User.create({
    name: "Invalid Post Comment User",
    email: "invalid-post-comments@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/posts/invalid-post-id/comments")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(400);
  });

  it("should reject an invalid comment ID when fetching replies", async () => {
  const user = await User.create({
    name: "Invalid Reply ID User",
    email: "invalid-reply-id@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get("/api/comments/invalid-comment-id/replies")
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(400);
  });

  it("should return 404 when fetching replies for a non-existent comment", async () => {
  const user = await User.create({
    name: "Missing Comment User",
    email: "missing-comment-replies@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/comments/${new mongoose.Types.ObjectId()}/replies`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("Comment not found");
  });

  it("should not allow unauthenticated users to fetch post comments", async () => {
  const user = await User.create({
    name: "Unauthenticated Comment Viewer",
    email: "unauth-comment-view@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for authentication test",
  });

  const response = await request(app)
    .get(`/api/posts/${post._id}/comments`);

  expect(response.status).toBe(401);
  });

  it("should not allow unauthenticated users to fetch comment replies", async () => {
  const user = await User.create({
    name: "Unauthenticated Reply Viewer",
    email: "unauth-reply-view@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post for reply authentication test",
  });

  const comment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Parent comment",
    parentCommentId: null,
    isDeleted: false,
  });

  const response = await request(app)
    .get(`/api/comments/${comment._id}/replies`);

  expect(response.status).toBe(401);
  });

  it("should return 404 when fetching replies of a deleted comment", async () => {
  const user = await User.create({
    name: "Deleted Parent User",
    email: "deleted-parent-replies@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const post = await Post.create({
    userId: user._id,
    text: "Post with deleted parent",
  });

  const comment = await CommentModel.create({
    postId: post._id,
    userId: user._id,
    text: "Deleted parent comment",
    parentCommentId: null,
    isDeleted: true,
  });

  const token = generateAccessToken({
    userId: user._id.toString(),
    role: "user",
  });

  const response = await request(app)
    .get(`/api/comments/${comment._id}/replies`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("Comment not found");
  });
});