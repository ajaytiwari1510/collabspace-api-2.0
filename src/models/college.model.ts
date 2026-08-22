import mongoose, { Schema, Document } from "mongoose";

export interface ICollege extends Document {
  name: string;
  city?: string;
  state?: string;
  isVerified: boolean;
  source: "seeded" | "user-added";
  createdAt: Date;
  updatedAt: Date;
}

const collegeSchema = new Schema<ICollege>(
  {
    name: {
      type: String,
      required: [true, "College name is required"],
      trim: true,
      unique: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      enum: ["seeded", "user-added"],
      default: "user-added",
    },
  },
  {
    timestamps: true,
  }
);

collegeSchema.index({ name: "text" });

export const College = mongoose.model<ICollege>("College", collegeSchema);