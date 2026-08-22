import { z } from "zod";

export const collegeSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, "Search query cannot be empty")
    .max(100, "Search query too long"),
});

export type CollegeSearchInput = z.infer<typeof collegeSearchSchema>;