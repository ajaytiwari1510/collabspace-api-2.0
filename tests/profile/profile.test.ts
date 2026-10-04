import { describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { User } from "../../src/models/user.model.js";
import { Profile } from "../../src/models/profile.model.js";
import { College } from "../../src/models/college.model.js";
import { generateAccessToken } from "../../src/utils/jwt.util.js";
import { env } from "../../src/config/env.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

describe("Profile API", () => {

  it("should return the authenticated user's profile", async () => {
    const user = await User.create({
      name: "Profile Test User",
      email: "profile-test@example.com",
      passwordHash: "test-hash",
      authMethod: "email",
    });

    const profile = await Profile.create({
      userId: user._id,
      displayName: "Profile Test User",
      headline: "Software Developer",
      bio: "Learning backend engineering",
      skills: ["TypeScript", "Node.js"],
      availability: "looking",
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = await request(app)
      .get("/api/profile/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.userId.toString()).toBe(user._id.toString());
    expect(response.body.data.displayName).toBe(profile.displayName);
    expect(response.body.data.headline).toBe(profile.headline);
  });

  it("should reject unauthenticated requests", async () => {
  const response = await request(app)
    .get("/api/profile/me");

  expect(response.status).toBe(401);
  expect(response.body.message).toBe("Not authenticated - token missing");
  });

  it("should return 404 when the authenticated user has no profile", async () => {
  const user = await User.create({
    name: "No Profile User",
    email: "no-profile@example.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .get("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("Profile not found");
  });

  it("should create a profile when profile does not exist", async () => {
  // Arrange
  const user = await User.create({
    name: "Test User",
    email: "profile-create@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const college = await College.create({
    name: "Test Engineering College",
    city: "Indore",
    state: "Madhya Pradesh",
    isVerified: true,
    source: "seeded",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const profileData = {
    displayName: "Test User",
    headline: "Software Developer",
    bio: "Learning backend development",
    collegeId: college._id.toString(),
    degree: "B.Tech",
    fieldOfStudy: "Information Technology",
    yearOfStudy: 4,
    city: "Indore",
    state: "Madhya Pradesh",
    skills: ["JavaScript", "TypeScript"],
    availability: "open",
    githubUrl: "https://github.com/testuser",
    linkedinUrl: "https://linkedin.com/in/testuser",
    websiteUrl: "https://testuser.com",
    isPublic: true,
  };

  // Act
  const response = await request(app)
    .put("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(profileData);

  // Assert
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.message).toBe("Profile updated successfully");
  expect(response.body.data.userId.toString()).toBe(user._id.toString());
  expect(response.body.data.displayName).toBe("Test User");
  expect(response.body.data.collegeId.name).toBe("Test Engineering College");

  const profile = await Profile.findOne({ userId: user._id });

  expect(profile).toBeDefined();
  });

  it("should update an existing profile", async () => {
  // Arrange
  const user = await User.create({
    name: "Test User",
    email: "profile-update@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const college = await College.create({
    name: "Update Test College",
    city: "Indore",
    state: "Madhya Pradesh",
    isVerified: true,
    source: "seeded",
  });

  const profile = await Profile.create({
    userId: user._id,
    displayName: "Test User",
    headline: "Software Developer",
    bio: "Learning backend development",
    collegeId: college._id,
    degree: "B.Tech",
    fieldOfStudy: "Information Technology",
    yearOfStudy: 4,
    city: "Indore",
    state: "Madhya Pradesh",
    skills: ["JavaScript"],
    availability: "open",
    isPublic: true,
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const updatedData = {
    headline: "Senior Software Developer",
    bio: "Building production backend systems",
  };

  // Act
  const response = await request(app)
    .put("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(updatedData);

  // Assert
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data.headline).toBe("Senior Software Developer");
  expect(response.body.data.bio).toBe("Building production backend systems");

  const updatedProfile = await Profile.findById(profile._id);

  expect(updatedProfile).toBeDefined();
  expect(updatedProfile!.headline).toBe("Senior Software Developer");
  expect(updatedProfile!.bio).toBe("Building production backend systems");

  const profileCount = await Profile.countDocuments({
    userId: user._id,
  });

  expect(profileCount).toBe(1);
  });

  it("should reject unauthenticated profile updates", async () => {
  // Act
  const response = await request(app)
    .put("/api/profile/me")
    .send({
      headline: "Updated Headline",
    });

  // Assert
  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
  expect(response.body.message).toBe(
    "Not authenticated - token missing"
  );
  });

  it("should reject an invalid college", async () => {
  // Arrange
  const user = await User.create({
    name: "Test User",
    email: "invalid-college@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const invalidCollegeId = new mongoose.Types.ObjectId();

  // Act
  const response = await request(app)
    .put("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      collegeId: invalidCollegeId.toString(),
    });

  // Assert
  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.message).toBe("Invalid college selected");

  const profile = await Profile.findOne({
    userId: user._id,
  });

  expect(profile).toBeNull();
  });

  it("should mark profile as complete when all required fields and skills are provided", async () => {
  // Arrange
  const user = await User.create({
    name: "Complete User",
    email: "profile-complete@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const college = await College.create({
    name: "Complete Test College",
    city: "Indore",
    state: "Madhya Pradesh",
    isVerified: true,
    source: "seeded",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  // Act
  const response = await request(app)
    .put("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      displayName: "Complete User",
      headline: "Software Developer",
      bio: "Building backend systems",
      collegeId: college._id.toString(),
      degree: "B.Tech",
      fieldOfStudy: "Information Technology",
      yearOfStudy: 4,
      city: "Indore",
      state: "Madhya Pradesh",
      skills: ["JavaScript"],
      availability: "open",
      isPublic: true,
    });

  // Assert
  expect(response.status).toBe(200);
  expect(response.body.data.profileComplete).toBe(true);

  const profile = await Profile.findOne({ userId: user._id });

  expect(profile).toBeDefined();
  expect(profile!.profileComplete).toBe(true);
  });

  it("should mark profile as incomplete when required fields are missing", async () => {
  // Arrange
  const user = await User.create({
    name: "Incomplete User",
    email: "profile-incomplete@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  // Act
  const response = await request(app)
    .put("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      displayName: "Incomplete User",
      headline: "Software Developer",
      skills: ["JavaScript"],
    });

  // Assert
  expect(response.status).toBe(200);
  expect(response.body.data.profileComplete).toBe(false);

  const profile = await Profile.findOne({ userId: user._id });

  expect(profile).toBeDefined();
  expect(profile!.profileComplete).toBe(false);
  });

  it("should preserve existing profile fields during a partial update", async () => {
  // Arrange
  const user = await User.create({
    name: "Partial Update User",
    email: "profile-partial@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const college = await College.create({
    name: "Partial Update College",
    city: "Indore",
    state: "Madhya Pradesh",
    isVerified: true,
    source: "seeded",
  });

  await Profile.create({
    userId: user._id,
    displayName: "Partial User",
    headline: "Software Developer",
    bio: "Learning backend development",
    collegeId: college._id,
    degree: "B.Tech",
    fieldOfStudy: "Information Technology",
    yearOfStudy: 4,
    city: "Indore",
    state: "Madhya Pradesh",
    skills: ["JavaScript", "TypeScript"],
    availability: "open",
    isPublic: true,
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  // Act
  const response = await request(app)
    .put("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      headline: "Backend Developer",
    });

  // Assert
  expect(response.status).toBe(200);
  expect(response.body.data.headline).toBe("Backend Developer");
  expect(response.body.data.bio).toBe("Learning backend development");
  expect(response.body.data.skills).toEqual(["JavaScript", "TypeScript"]);
  expect(response.body.data.displayName).toBe("Partial User");

  const updatedProfile = await Profile.findOne({
    userId: user._id,
  });

  expect(updatedProfile).toBeDefined();
  expect(updatedProfile!.headline).toBe("Backend Developer");
  expect(updatedProfile!.bio).toBe("Learning backend development");
  expect(updatedProfile!.skills).toEqual(["JavaScript", "TypeScript"]);
  });

  it("should reject an invalid access token", async () => {
  // Act
  const response = await request(app)
    .get("/api/profile/me")
    .set("Authorization", "Bearer invalid-access-token");

  // Assert
  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
  expect(response.body.message).toBe("Invalid or expired token");
  });

  it("should reject an expired access token", async () => {
  // Arrange
  const user = await User.create({
    name: "Expired Token User",
    email: "expired-token@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const expiredToken = jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: -1,
    }
  );

  // Act
  const response = await request(app)
    .get("/api/profile/me")
    .set("Authorization", `Bearer ${expiredToken}`);

  // Assert
  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
  expect(response.body.message).toBe("Invalid or expired token");
  });

  it("should return only the authenticated user's profile", async () => {
  // Arrange
  const userA = await User.create({
    name: "User A",
    email: "user-a-isolation@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "User B",
    email: "user-b-isolation@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  await Profile.create({
    userId: userA._id,
    displayName: "Profile A",
    headline: "Developer A",
    skills: ["JavaScript"],
  });

  await Profile.create({
    userId: userB._id,
    displayName: "Profile B",
    headline: "Developer B",
    skills: ["TypeScript"],
  });

  const accessToken = generateAccessToken({
    userId: userA._id.toString(),
    role: userA.role,
  });

  // Act
  const response = await request(app)
    .get("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`);

  // Assert
  expect(response.status).toBe(200);
  expect(response.body.data.userId.toString()).toBe(userA._id.toString());
  expect(response.body.data.displayName).toBe("Profile A");
  expect(response.body.data.displayName).not.toBe("Profile B");
  });

  it("should reject an invalid year of study", async () => {
  // Arrange
  const user = await User.create({
    name: "Invalid Year User",
    email: "invalid-year@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  // Act
  const response = await request(app)
    .put("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      yearOfStudy: 0,
    });

  // Assert
  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const profile = await Profile.findOne({
    userId: user._id,
  });

  expect(profile).toBeNull();
  });

  it("should reject more than 20 skills", async () => {
  // Arrange
  const user = await User.create({
    name: "Too Many Skills User",
    email: "too-many-skills@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const skills = Array.from(
    { length: 21 },
    (_, index) => `Skill${index + 1}`
  );

  // Act
  const response = await request(app)
    .put("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      skills,
    });

  // Assert
  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const profile = await Profile.findOne({
    userId: user._id,
  });

  expect(profile).toBeNull();
  });

  it("should reject an invalid GitHub URL", async () => {
  // Arrange
  const user = await User.create({
    name: "Invalid URL User",
    email: "invalid-url@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  // Act
  const response = await request(app)
    .put("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      githubUrl: "not-a-valid-url",
    });

  // Assert
  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const profile = await Profile.findOne({
    userId: user._id,
  });

  expect(profile).toBeNull();
  });

  it("should reject a display name containing only whitespace", async () => {
  // Arrange
  const user = await User.create({
    name: "Whitespace User",
    email: "whitespace@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  // Act
  const response = await request(app)
    .put("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      displayName: "   ",
    });

  // Assert
  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const profile = await Profile.findOne({
    userId: user._id,
  });

  expect(profile).toBeNull();
  });

  it("should reject a headline containing only whitespace", async () => {
  // Arrange
  const user = await User.create({
    name: "Whitespace Headline User",
    email: "whitespace-headline@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  // Act
  const response = await request(app)
    .put("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      headline: "   ",
    });

  // Assert
  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const profile = await Profile.findOne({
    userId: user._id,
  });

  expect(profile).toBeNull();
  });

  it("should reject empty skills", async () => {
  // Arrange
  const user = await User.create({
    name: "Empty Skill User",
    email: "empty-skill@test.com",
    passwordHash: "test-hash",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  // Act
  const response = await request(app)
    .put("/api/profile/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      skills: ["JavaScript", "   ", "TypeScript"],
    });

  // Assert
  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const profile = await Profile.findOne({
    userId: user._id,
  });

  expect(profile).toBeNull();
  });

  
  
});