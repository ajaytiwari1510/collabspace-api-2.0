import mongoose, { Schema, Document, Types } from "mongoose";

export interface ILike extends Document {
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  createdAt: Date;
}

const likeSchema = new Schema<ILike>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Duplicate-like prevention — DB-level guarantee, race-condition-proof
likeSchema.index({ userId: 1, postId: 1 }, { unique: true });

// Post ke saare likes fetch karne ke liye (jaise "who liked this post" feature future mein)
likeSchema.index({ postId: 1, createdAt: -1 });

export const Like = mongoose.model<ILike>("Like", likeSchema);