import mongoose, { Schema, Document, Types } from "mongoose";

export interface IConnection extends Document {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  status: "pending" | "accepted";
  createdAt: Date;
  updatedAt: Date;
}

const connectionSchema = new Schema<IConnection>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index - ek pair ke beech sirf EK document ho sakta hai
connectionSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });

export const Connection = mongoose.model<IConnection>("Connection", connectionSchema);