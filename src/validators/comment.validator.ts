import { z } from "zod";
import { objectIdSchema } from "./common.validator.js";

export const createCommentSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(500, "Comment cannot exceed 500 characters"),

  parentCommentId: objectIdSchema.optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;