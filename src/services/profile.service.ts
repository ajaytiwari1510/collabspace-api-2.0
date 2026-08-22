import { Profile } from "../models/profile.model.js";
import { College } from "../models/college.model.js";
import { ApiError } from "../utils/apiError.util.js";
import type { UpdateProfileInput } from "../validators/profile.validator.js";

const REQUIRED_FIELDS_FOR_COMPLETION = [
  "displayName", "headline", "bio", "collegeId",
  "degree", "fieldOfStudy", "city",
] as const;

const calculateProfileComplete = (profileData: Record<string, unknown>): boolean => {
  const hasRequiredFields = REQUIRED_FIELDS_FOR_COMPLETION.every(
    (field) => profileData[field] !== undefined && profileData[field] !== null && profileData[field] !== ""
  );
  const hasSkills = Array.isArray(profileData.skills) && profileData.skills.length > 0;

  return hasRequiredFields && hasSkills;
};

export const getProfile = async (userId: string) => {
  const profile = await Profile.findOne({ userId }).populate("collegeId", "name city state");

  if (!profile) {
    throw new ApiError(404, "Profile not found");
  }

  return profile;
};

export const updateProfile = async (userId: string, input: UpdateProfileInput) => {
  // Step 1: Agar collegeId diya hai, verify karo woh real hai
  if (input.collegeId) {
    const collegeExists = await College.findById(input.collegeId);
    if (!collegeExists) {
      throw new ApiError(400, "Invalid college selected");
    }
  }

  // Step 2: Existing profile dhoondo (agar hai)
  let profile = await Profile.findOne({ userId });

  // Step 3: Merge existing data with new data for completeness check
  const mergedData = {
    ...(profile?.toObject() || {}),
    ...input,
  };

  const isComplete = calculateProfileComplete(mergedData);

  // Step 4: Upsert - update if exists, create if not
  profile = await Profile.findOneAndUpdate(
    { userId },
    {
      ...input,
      profileComplete: isComplete,
      lastActiveAt: new Date(),
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  ).populate("collegeId", "name city state");

  return profile;
};