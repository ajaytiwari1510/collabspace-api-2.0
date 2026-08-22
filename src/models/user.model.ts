import mongoose, { Schema, Document } from "mongoose";

// Step 1: TypeScript interface - batata hai User document ka shape kya hai
export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string; // optional - Google auth users ke paas nahi hoga
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

// Step 2: Mongoose schema - runtime pe enforce karega yeh rules
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
      select: false, // API response me kabhi nahi aayega by default
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
    timestamps: true, // automatically createdAt aur updatedAt add karta hai
  }
);

// Step 3: Index - fast lookup ke liye email par
// userSchema.index({ email: 1 }); We already have the "unique: true in email"

// Step 4: Model export - is se hum User.create(), User.findOne() etc. karenge
export const User = mongoose.model<IUser>("User", userSchema);