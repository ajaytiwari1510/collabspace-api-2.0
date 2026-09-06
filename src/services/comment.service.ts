import { CommentModel } from "../models/comment.model.js";
import { Post } from "../models/post.model.js";
import { ApiError } from "../utils/apiError.util.js";
import mongoose from "mongoose";

// Create a new comment or reply
export const createComment = async (
  postId: string,
  userId: string,
  text: string,
  parentCommentId?: string
) => {

  // Check that the post exists and is not deleted.
  const post = await Post.findById(postId);

  if (!post || post.isDeleted) {
    throw new ApiError(404, "Post not found");
  }

  // Validate the parent comment when creating a reply.
  if (parentCommentId) {
    const parentComment = await CommentModel.findOne({
      _id: parentCommentId,
      postId,
    });

    if (!parentComment || parentComment.isDeleted) {
      throw new ApiError(404, "Parent comment not found");
    }

    // Allow only one level of replies.
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

    // Create the comment inside the transaction.
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

    // Atomically increment the post comment count.
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
        new: true,
      }
    );

    if (!updatedPost) {
      throw new ApiError(404, "Post not found");
    }

    // Commit both database changes.
    await session.commitTransaction();

    // Detach the document from the expired transaction session.
    comment.$session(null);

    // Populate user information for the response.
    await comment.populate("userId", "name");
    return comment;

  } catch (error) {
    // Roll back changes if anything fails.
    await session.abortTransaction();
    throw error;
  } finally {
    // Always close the session.
    await session.endSession();
  }
};

// Delete a comment
export const deleteComment = async (
  commentId: string,
  userId: string
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Find the comment inside the transaction.
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

    // Soft-delete the comment.
    comment.isDeleted = true;
    await comment.save({ session });

    // Decrement the post comment count.
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
        new: true,
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

// Get top-level comments of a post
export const getPostComments = async (
  postId: string,
  page: number,
  limit: number
) => {
  // Check if post exists
  const post = await Post.findById(postId);

  if (!post || post.isDeleted) {
    throw new ApiError(404, "Post not found");
  }

  const skip = (page - 1) * limit;

  // Get top-level comments
  const comments = await CommentModel.find({
    postId,
    parentCommentId: null,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId", "name");

  // Count total comments
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

// Get replies of a comment
export const getCommentReplies = async (
  commentId: string,
  page: number,
  limit: number
) => {
  // Find the parent comment
  const parentComment = await CommentModel.findById(commentId);

  if (!parentComment || parentComment.isDeleted) {
    throw new ApiError(404, "Comment not found");
  }

  const skip = (page - 1) * limit;

  // Get replies
  const replies = await CommentModel.find({
    parentCommentId: commentId,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId", "name");

  // Count total replies
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