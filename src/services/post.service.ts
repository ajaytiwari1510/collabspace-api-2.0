import { Post } from "../models/post.model.js";
import { Profile } from "../models/profile.model.js";
import { ApiError } from "../utils/apiError.util.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.util.js";
import type { CreatePostInput } from "../validators/post.validator.js";
import { areUsersConnected } from "./connection.service.js";

export const createPost = async (
  userId: string,
  input: CreatePostInput,
  imageBuffer?: Buffer
) => {
  let imageUrl: string | undefined;

  if (imageBuffer) {
    imageUrl = await uploadToCloudinary(imageBuffer, "collabspace/posts");
  }

  const post = await Post.create({
    userId,
    text: input.text,
    imageUrl,
  });

  return post;
};

export const getFeed = async (page: number, limit: number) => {
  const skip = (page - 1) * limit;

  const posts = await Post.find({ isDeleted: false })
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId", "name");

  const total = await Post.countDocuments({ isDeleted: false });

  return {
    posts,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + posts.length < total,
    },
  };
};

export const deletePost = async (postId: string, userId: string) => {
  const post = await Post.findById(postId);

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  if (post.userId.toString() !== userId) {
    throw new ApiError(403, "You are not authorized to delete this post");
  }

  post.isDeleted = true;
  await post.save();

  return { message: "Post deleted successfully" };
};

export const getUserPosts = async (
  targetUserId: string,
  viewerId: string,
  page: number,
  limit: number
) => {
  const isSelf = targetUserId === viewerId;

  if (!isSelf) {
    const targetProfile = await Profile.findOne({ userId: targetUserId });

    if (targetProfile && !targetProfile.isPublic) {
      const connected = await areUsersConnected(viewerId, targetUserId);

      if (!connected) {
        throw new ApiError(403, "This profile is private");
      }
    }
  }

  const skip = (page - 1) * limit;

  const posts = await Post.find({
    userId: targetUserId,
    isDeleted: false,
  })
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId", "name");

  const total = await Post.countDocuments({
    userId: targetUserId,
    isDeleted: false,
  });

  return {
    posts,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + posts.length < total,
    },
  };
};