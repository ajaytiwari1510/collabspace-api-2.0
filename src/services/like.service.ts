import mongoose from "mongoose";
import { Like } from "../models/like.model.js";
import { Post } from "../models/post.model.js";
import { Notification } from "../models/notification.model.js";
import { ApiError } from "../utils/apiError.util.js";
import { getIO } from "../socket/index.js";

export const likePost = async (postId: string, userId: string) => {
  const post = await Post.findById(postId);
  if (!post || post.isDeleted) {
    throw new ApiError(404, "Post not found");
  }

  const session = await mongoose.startSession();
  let notificationDoc;
  const isSelfLike = post.userId.toString() === userId;

  try {
    await session.withTransaction(async () => {
      try {
        await Like.create([{ userId, postId }], { session });
      } catch (error: any) {
        if (error.code === 11000) {
          throw new ApiError(409, "You already liked this post");
        }
        throw error;
      }

      post.likeCount += 1;
      await post.save({ session });

      // Self-like pe notification nahi banani
      if (!isSelfLike) {
        const [notification] = await Notification.create(
          [
            {
              receiverId: post.userId,
              senderId: userId,
              type: "post_liked",
              refId: post._id,
              refModel: "Post",
              message: "liked your post",
            },
          ],
          { session }
        );
        notificationDoc = notification;
      }
    });
  } finally {
    await session.endSession();
  }

  // Transaction commit ho chuka — ab safe hai real-time emit karna
  if (notificationDoc) {
    getIO().to(post.userId.toString()).emit("new_notification", notificationDoc);
  }

  return { message: "Post liked" };
};

export const unlikePost = async (postId: string, userId: string) => {
  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const deleted = await Like.findOneAndDelete({ userId, postId }, { session });

      if (!deleted) {
        throw new ApiError(404, "You haven't liked this post");
      }

      post.likeCount = Math.max(0, post.likeCount - 1);
      await post.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return { message: "Post unliked" };
};