import mongoose, { Schema, Document, Types } from "mongoose";

interface ILastMessage {
  messageId: Types.ObjectId;
  text?: string;
  senderId: Types.ObjectId;
  sentAt: Date;
}

export interface IConversation extends Document {
  participants: Types.ObjectId[];
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  createdBy: Types.ObjectId;
  lastMessage?: ILastMessage;
  deletedBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      trim: true,
    },
    groupAvatar: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastMessage: {
      messageId: { type: Schema.Types.ObjectId, ref: "Message" },
      text: { type: String },
      senderId: { type: Schema.Types.ObjectId, ref: "User" },
      sentAt: { type: Date },
    },
    deletedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

export const Conversation = mongoose.model<IConversation>("Conversation", conversationSchema);