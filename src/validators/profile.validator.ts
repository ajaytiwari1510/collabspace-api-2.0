import { z } from "zod";

const DEGREE_OPTIONS = [
  "B.Tech", "M.Tech", "BCA", "MCA", "B.Sc", "M.Sc",
  "MBA", "BBA", "B.Com", "M.Com", "PhD", "Diploma", "Other",
] as const;

const FIELD_OF_STUDY_OPTIONS = [
  "Computer Science", "Information Technology", "Electronics & Communication",
  "Electrical Engineering", "Mechanical Engineering", "Civil Engineering",
  "Chemical Engineering", "Aerospace Engineering", "Biotechnology",
  "Data Science", "Artificial Intelligence & Machine Learning",
  "Business Administration", "Finance", "Marketing",
  "Mathematics", "Physics", "Chemistry", "Economics", "Other",
] as const;

const baseProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name cannot be empty")
    .max(50, "Display name too long"),

  headline: z
    .string()
    .trim()
    .min(1, "Headline cannot be empty")
    .max(100, "Headline too long"),

  bio: z
    .string()
    .trim()
    .min(1, "Bio cannot be empty")
    .max(500, "Bio too long"),

  collegeId: z.string().length(24, "Invalid college ID"),

  degree: z.enum(DEGREE_OPTIONS),

  fieldOfStudy: z.enum(FIELD_OF_STUDY_OPTIONS),

  yearOfStudy: z.number().int().min(1).max(6),

  city: z
    .string()
    .trim()
    .min(1, "City cannot be empty")
    .max(50, "City too long"),

  state: z
    .string()
    .trim()
    .min(1, "State cannot be empty")
    .max(50, "State too long"),

  skills: z
    .array(z.string().trim().min(1, "Skill cannot be empty"))
    .max(20, "Maximum 20 skills allowed"),

  availability: z.enum(["open", "busy", "looking"]),

  githubUrl: z.url("Invalid GitHub URL"),

  linkedinUrl: z.url("Invalid LinkedIn URL"),

  websiteUrl: z.url("Invalid website URL"),

  isPublic: z.boolean(),
});

export const updateProfileSchema = baseProfileSchema.partial();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;