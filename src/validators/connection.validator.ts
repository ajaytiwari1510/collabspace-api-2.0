import { z } from "zod";

export const sendConnectionRequestSchema = z.object({
  receiverId: z.string().length(24, "Invalid user ID"),
});

export type SendConnectionRequestInput = z.infer<typeof sendConnectionRequestSchema>;