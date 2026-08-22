import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPost extends Document {
  userId: Types.ObjectId;
  text: string;
  imageUrl?: string;
  likeCount: number;
  commentCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: [true, "Post text is required"],
      trim: true,
      maxlength: [2000, "Post cannot exceed 2000 characters"],
    },
    imageUrl: {
      type: String,
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Feed ke liye - naye posts pehle dikhane ke liye
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

export const Post = mongoose.model<IPost>("Post", postSchema);