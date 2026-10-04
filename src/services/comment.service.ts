import { CommentModel } from "../models/comment.model.js";
import { Post } from "../models/post.model.js";
import { ApiError } from "../utils/apiError.util.js";
import mongoose from "mongoose";

export const createComment = async (
  postId: string,
  userId: string,
  text: string,
  parentCommentId?: string
) => {
  const post = await Post.findById(postId);

  if (!post || post.isDeleted) {
    throw new ApiError(404, "Post not found");
  }

  if (parentCommentId) {
    const parentComment = await CommentModel.findOne({
      _id: parentCommentId,
      postId,
    });

    if (!parentComment || parentComment.isDeleted) {
      throw new ApiError(404, "Parent comment not found");
    }

    // Only one level of replies is allowed.
    if (parentComment.parentCommentId) {
      throw new ApiError(
        400,
        "Cannot reply to a reply - only one level of nesting is allowed"
      );
    }
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const [comment] = await CommentModel.create(
      [
        {
          postId,
          userId,
          text,
          parentCommentId: parentCommentId || null,
        },
      ],
      { session }
    );

    const updatedPost = await Post.findOneAndUpdate(
      {
        _id: postId,
        isDeleted: false,
      },
      {
        $inc: { commentCount: 1 },
      },
      {
        session,
        returnDocument: "after",
      }
    );

    if (!updatedPost) {
      throw new ApiError(404, "Post not found");
    }

    await session.commitTransaction();

    // The transaction session is no longer valid after commit.
    comment.$session(null);

    await comment.populate("userId", "name");

    return comment;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const deleteComment = async (
  commentId: string,
  userId: string
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const comment = await CommentModel.findById(commentId).session(session);

    if (!comment) {
      throw new ApiError(404, "Comment not found");
    }

    if (comment.userId.toString() !== userId) {
      throw new ApiError(403, "You can only delete your own comments");
    }

    if (comment.isDeleted) {
      throw new ApiError(400, "Comment already deleted");
    }

    comment.isDeleted = true;
    await comment.save({ session });

    const updatedPost = await Post.findOneAndUpdate(
      {
        _id: comment.postId,
        isDeleted: false,
        commentCount: { $gt: 0 },
      },
      {
        $inc: { commentCount: -1 },
      },
      {
        session,
        returnDocument: "after",
      }
    );

    if (!updatedPost) {
      throw new ApiError(404, "Post not found");
    }

    await session.commitTransaction();

    return { message: "Comment deleted" };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const getPostComments = async (
  postId: string,
  page: number,
  limit: number
) => {
  const post = await Post.findById(postId);

  if (!post || post.isDeleted) {
    throw new ApiError(404, "Post not found");
  }

  const skip = (page - 1) * limit;

  const comments = await CommentModel.find({
    postId,
    parentCommentId: null,
    isDeleted: false,
  })
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId", "name");

  const total = await CommentModel.countDocuments({
    postId,
    parentCommentId: null,
    isDeleted: false,
  });

  return {
    comments,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + comments.length < total,
    },
  };
};

export const getCommentReplies = async (
  commentId: string,
  page: number,
  limit: number
) => {
  const parentComment = await CommentModel.findById(commentId);

  if (!parentComment || parentComment.isDeleted) {
    throw new ApiError(404, "Comment not found");
  }

  const skip = (page - 1) * limit;

  const replies = await CommentModel.find({
    parentCommentId: commentId,
    isDeleted: false,
  })
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId", "name");

  const total = await CommentModel.countDocuments({
    parentCommentId: commentId,
    isDeleted: false,
  });

  return {
    replies,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + replies.length < total,
    },
  };
};