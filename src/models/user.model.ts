import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string; // Optional for Google auth users.
  role: "user" | "admin";
  isVerified: boolean;
  isBanned: boolean;
  loginFailCount: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  authMethod: "email" | "google";
  passwordChangedAt?: Date;
  refreshTokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      select: false, // Excluded from queries by default.
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    loginFailCount: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
    },
    lastLoginAt: {
      type: Date,
    },
    authMethod: {
      type: String,
      enum: ["email", "google"],
      required: true,
    },
    passwordChangedAt: {
      type: Date,
    },
    refreshTokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically.
  }
);

export const User = mongoose.model<IUser>("User", userSchema);