import mongoose, { Schema, Document, Types } from "mongoose";

interface IReadReceipt {
  userId: Types.ObjectId;
  readAt: Date;
}

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  text?: string;
  imageUrl?: string;
  messageType: "text" | "image" | "text_image";
  readBy: IReadReceipt[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    imageUrl: {
      type: String,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "text_image"],
      required: true,
    },
    readBy: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

// --- Fix #4: cross-field validation ---
messageSchema.pre("validate", function () {
  const hasText = !!this.text && this.text.trim().length > 0;
  const hasImage = !!this.imageUrl;

  switch (this.messageType) {
    case "text":
      if (!hasText) {
        this.invalidate("text", "text is required when messageType is 'text'");
      }
      if (hasImage) {
        this.invalidate("imageUrl", "imageUrl must not be set when messageType is 'text'");
      }
      break;

    case "image":
      if (!hasImage) {
        this.invalidate("imageUrl", "imageUrl is required when messageType is 'image'");
      }
      if (hasText) {
        this.invalidate("text", "text must not be set when messageType is 'image'");
      }
      break;

    case "text_image":
      if (!hasText) {
        this.invalidate("text", "text is required when messageType is 'text_image'");
      }
      if (!hasImage) {
        this.invalidate("imageUrl", "imageUrl is required when messageType is 'text_image'");
      }
      break;
  }
});

export const Message = mongoose.model<IMessage>("Message", messageSchema);