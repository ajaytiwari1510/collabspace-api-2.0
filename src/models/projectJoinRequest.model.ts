import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProjectJoinRequest extends Document {
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  status: "pending";
  createdAt: Date;
  updatedAt: Date;
}

const projectJoinRequestSchema = new Schema<IProjectJoinRequest>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Ek user, ek project ke liye sirf EK pending request bhej sake (duplicate rokta hai)
projectJoinRequestSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const ProjectJoinRequest = mongoose.model<IProjectJoinRequest>(
  "ProjectJoinRequest",
  projectJoinRequestSchema
);