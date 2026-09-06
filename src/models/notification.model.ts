import mongoose, { Schema, Document, Types } from "mongoose";

export type NotificationType =
  | "connection_request"
  | "connection_accepted"
  | "project_join_request"
  | "project_request_accepted"
  | "project_request_rejected"
  | "removed_from_project"
  | "ownership_transferred"
  | "post_liked";

export interface INotification extends Document {
  receiverId: Types.ObjectId;
  senderId?: Types.ObjectId;
  type: NotificationType;
  refId?: Types.ObjectId;
  refModel?: "Connection" | "Project" | "ProjectJoinRequest" | "Post";
  message: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    type: {
      type: String,
      enum: [
        "connection_request",
        "connection_accepted",
        "project_join_request",
        "project_request_accepted",
        "project_request_rejected",
        "removed_from_project",
        "ownership_transferred",
        "post_liked",
      ],
      required: true,
    },

    refId: {
      type: Schema.Types.ObjectId,
      refPath: "refModel",
    },

    refModel: {
      type: String,
      enum: ["Connection", "Project", "ProjectJoinRequest", "Post"],
    },

    message: {
      type: String,
      required: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ receiverId: 1, createdAt: -1 });

notificationSchema.index({ receiverId: 1, isRead: 1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);