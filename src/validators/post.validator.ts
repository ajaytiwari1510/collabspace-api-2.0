import { z } from "zod";

export const createPostSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Post text cannot be empty")
    .max(2000, "Post cannot exceed 2000 characters"),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;