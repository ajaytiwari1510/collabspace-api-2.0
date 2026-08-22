// src/models/project.model.ts

import mongoose, { Schema, Document, Types } from "mongoose";

interface IProjectMember {
  userId: Types.ObjectId;
  role: "owner" | "member";
  joinedAt: Date;
}

export interface IProject extends Document {
  title: string;
  description: string;
  createdBy: Types.ObjectId;
  skillsNeeded: string[];
  members: IProjectMember[];
  maxMembers: number;
  status: "open" | "closed" | "completed";
  githubUrl?: string;
  demoUrl?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    title: {
      type: String,
      required: [true, "Project title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Project description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    skillsNeeded: {
      type: [String],
      default: [],
    },
    members: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["owner", "member"],
          default: "member",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    maxMembers: {
      type: Number,
      required: [true, "Maximum members limit is required"],
      min: [2, "A project needs at least 2 members"],
      max: [20, "Maximum 20 members allowed"],
    },
    status: {
      type: String,
      enum: ["open", "closed", "completed"],
      default: "open",
    },
    githubUrl: {
      type: String,
      trim: true,
    },
    demoUrl: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ status: 1, createdAt: -1 });
projectSchema.index({ skillsNeeded: 1 });

export const Project = mongoose.model<IProject>("Project", projectSchema);