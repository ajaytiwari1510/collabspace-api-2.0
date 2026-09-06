import { z } from "zod";
import { objectIdSchema } from "./common.validator.js";

export const createProjectSchema = z.object({
  title: z.string().trim().min(3, "Title too short").max(100, "Title too long"),
  description: z.string().trim().min(10, "Description too short").max(2000, "Description too long"),
  skillsNeeded: z.array(z.string().trim()).max(20, "Maximum 20 skills allowed").default([]),
  maxMembers: z.number().int().min(2, "At least 2 members required").max(20, "Maximum 20 members allowed"),
  githubUrl: z.url("Invalid GitHub URL").optional(),
  demoUrl: z.url("Invalid demo URL").optional(),
  tags: z.array(z.string().trim()).max(10, "Maximum 10 tags allowed").default([]),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;


export const discoverProjectSchema = z.object({
  skill: z
    .string()
    .trim()
    .min(1, "Skill cannot be empty")
    .max(50, "Skill too long")
    .optional(),
});

export type DiscoverProjectInput = z.infer<typeof discoverProjectSchema>;


export const transferOwnershipSchema = z.object({
  newOwnerId: objectIdSchema,
});

export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;