import { z } from "zod";

export const startConversationSchema = z.object({
  otherUserId: z.string().min(1, "otherUserId is required"),
});

export const conversationIdSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  text: z.string().trim().max(2000).optional(),
  imageUrl: z.url("Invalid image URL").optional(),
  messageType: z.enum(["text", "image", "text_image"]),
});

export type StartConversationInput = z.infer<typeof startConversationSchema>;