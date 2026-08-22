import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProfile extends Document {
  userId: Types.ObjectId;
  displayName?: string;
  headline?: string;
  bio?: string;
  collegeId?: Types.ObjectId;
  degree?: string;
  fieldOfStudy?: string;
  yearOfStudy?: number;
  city?: string;
  state?: string;
  skills: string[];
  availability: "open" | "busy" | "looking";
  githubUrl?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  avatarUrl?: string;
  isPublic: boolean;
  profileComplete: boolean;
  profileScore: number;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

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

const profileSchema = new Schema<IProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    headline: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    collegeId: {
      type: Schema.Types.ObjectId,
      ref: "College",
    },
    degree: {
      type: String,
      enum: DEGREE_OPTIONS,
    },
    fieldOfStudy: {
      type: String,
      enum: FIELD_OF_STUDY_OPTIONS,
    },
    yearOfStudy: {
      type: Number,
      min: 1,
      max: 6,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    availability: {
      type: String,
      enum: ["open", "busy", "looking"],
      default: "looking",
    },
    githubUrl: {
      type: String,
      trim: true,
    },
    linkedinUrl: {
      type: String,
      trim: true,
    },
    websiteUrl: {
      type: String,
      trim: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    profileComplete: {
      type: Boolean,
      default: false,
    },
    profileScore: {
      type: Number,
      default: 0,
    },
    lastActiveAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

profileSchema.index({ city: 1, state: 1 });
profileSchema.index({ skills: 1 });

export const Profile = mongoose.model<IProfile>("Profile", profileSchema);