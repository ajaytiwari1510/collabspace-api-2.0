import request from "supertest";
import mongoose from "mongoose";
import app from "../../src/app.js";
import { User } from "../../src/models/user.model.js";
import { Project } from "../../src/models/project.model.js";
import { ProjectJoinRequest } from "../../src/models/projectJoinRequest.model.js";
import { generateAccessToken } from "../../src/utils/jwt.util.js";
import { describe, it, expect, beforeEach } from "vitest";

describe("Projects", () => {
  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  it("should create a project successfully", async () => {
    const user = await User.create({
      name: "Project Owner",
      email: "project-owner@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "CollabSpace Project",
        description: "A project for building something useful together",
        skillsNeeded: ["TypeScript", "MongoDB"],
        maxMembers: 5,
        githubUrl: "https://github.com/example/project",
        demoUrl: "https://example.com/demo",
        tags: ["backend", "collaboration"],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Project created");

    const project = await Project.findOne({
      title: "CollabSpace Project",
    });

    expect(project).not.toBeNull();
    expect(project?.createdBy.toString()).toBe(user._id.toString());
    expect(project?.members).toHaveLength(1);
    expect(project?.members[0].userId.toString()).toBe(user._id.toString());
    expect(project?.members[0].role).toBe("owner");
    expect(project?.maxMembers).toBe(5);
    expect(project?.status).toBe("open");
  });

  it("should not allow an unauthenticated user to create a project", async () => {
    const response = await request(app)
      .post("/api/projects")
      .send({
        title: "Unauthorized Project",
        description: "This project should not be created",
        skillsNeeded: ["TypeScript"],
        maxMembers: 5,
        tags: ["test"],
      });

    expect(response.status).toBe(401);

    const project = await Project.findOne({
      title: "Unauthorized Project",
    });

    expect(project).toBeNull();
  });

  it("should reject a project with a title shorter than 3 characters", async () => {
    const user = await User.create({
      name: "Validation User",
      email: "validation-title@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Hi",
        description: "This is a valid project description",
        maxMembers: 5,
      });

    expect(response.status).toBe(400);

    const project = await Project.findOne({
      title: "Hi",
    });

    expect(project).toBeNull();
  });

  it("should reject a project with a description shorter than 10 characters", async () => {
    const user = await User.create({
      name: "Validation Description User",
      email: "validation-description@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Valid Project Title",
        description: "Short",
        maxMembers: 5,
      });

    expect(response.status).toBe(400);

    const project = await Project.findOne({
      title: "Valid Project Title",
    });

    expect(project).toBeNull();
  });

  it("should reject a project with fewer than 2 max members", async () => {
    const user = await User.create({
      name: "Validation Members User",
      email: "validation-members@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Valid Project Title",
        description: "This is a valid project description",
        maxMembers: 1,
      });

    expect(response.status).toBe(400);

    const project = await Project.findOne({
      title: "Valid Project Title",
    });

    expect(project).toBeNull();
  });

  it("should reject a project with more than 20 max members", async () => {
    const user = await User.create({
      name: "Validation Max User",
      email: "validation-max@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Valid Project Title",
        description: "This is a valid project description",
        maxMembers: 21,
      });

    expect(response.status).toBe(400);

    const project = await Project.findOne({
      title: "Valid Project Title",
    });

    expect(project).toBeNull();
  });

  it("should reject a project with more than 20 skills", async () => {
    const user = await User.create({
      name: "Validation Skills User",
      email: "validation-skills@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Valid Project Title",
        description: "This is a valid project description",
        skillsNeeded: Array.from(
          { length: 21 },
          (_, i) => `Skill${i + 1}`
        ),
        maxMembers: 5,
      });

    expect(response.status).toBe(400);

    const project = await Project.findOne({
      title: "Valid Project Title",
    });

    expect(project).toBeNull();
  });

  it("should reject a project with more than 10 tags", async () => {
    const user = await User.create({
      name: "Validation Tags User",
      email: "validation-tags@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Valid Project Title",
        description: "This is a valid project description",
        maxMembers: 5,
        tags: Array.from(
          { length: 11 },
          (_, i) => `Tag${i + 1}`
        ),
      });

    expect(response.status).toBe(400);

    const project = await Project.findOne({
      title: "Valid Project Title",
    });

    expect(project).toBeNull();
  });

  it("should reject an invalid GitHub URL", async () => {
    const user = await User.create({
      name: "Validation URL User",
      email: "validation-url@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Valid Project Title",
        description: "This is a valid project description",
        maxMembers: 5,
        githubUrl: "not-a-url",
      });

    expect(response.status).toBe(400);

    const project = await Project.findOne({
      title: "Valid Project Title",
    });

    expect(project).toBeNull();
  });

  it("should reject an invalid demo URL", async () => {
    const user = await User.create({
      name: "Validation Demo User",
      email: "validation-demo@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Valid Project Title",
        description: "This is a valid project description",
        maxMembers: 5,
        demoUrl: "not-a-url",
      });

    expect(response.status).toBe(400);

    const project = await Project.findOne({
      title: "Valid Project Title",
    });

    expect(project).toBeNull();
  });

  it("should discover open projects", async () => {
    const user = await User.create({
      name: "Discovery User",
      email: "discovery@test.com",
      passwordHash: "hashed-password",
      authMethod: "email",
    });

    await Project.create({
      title: "Open Project",
      description: "This is an open project for collaboration",
      createdBy: user._id,
      maxMembers: 5,
      status: "open",
    });

    await Project.create({
      title: "Closed Project",
      description: "This project is no longer accepting members",
      createdBy: user._id,
      maxMembers: 5,
      status: "closed",
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = await request(app)
      .get("/api/projects/discover")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const projects = response.body.data.projects;

    expect(projects).toHaveLength(1);
    expect(projects[0].title).toBe("Open Project");
    expect(projects[0].status).toBe("open");
  });

  it("should discover projects by skill", async () => {
  const user = await User.create({
    name: "Skill Discovery User",
    email: "skill-discovery@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Project.create({
    title: "TypeScript Project",
    description: "A project looking for TypeScript developers",
    createdBy: user._id,
    skillsNeeded: ["TypeScript", "MongoDB"],
    maxMembers: 5,
    status: "open",
  });

  await Project.create({
    title: "Python Project",
    description: "A project looking for Python developers",
    createdBy: user._id,
    skillsNeeded: ["Python", "Django"],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .get("/api/projects/discover")
    .query({ skill: "TypeScript" })
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const projects = response.body.data.projects;

  expect(projects).toHaveLength(1);
  expect(projects[0].title).toBe("TypeScript Project");
  expect(projects[0].skillsNeeded).toContain("TypeScript");
  });

  it("should discover projects by skill case-insensitively", async () => {
  const user = await User.create({
    name: "Case Skill User",
    email: "case-skill@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Project.create({
    title: "TypeScript Project",
    description: "A project looking for TypeScript developers",
    createdBy: user._id,
    skillsNeeded: ["TypeScript", "MongoDB"],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .get("/api/projects/discover")
    .query({ skill: "typescript" })
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const projects = response.body.data.projects;

  expect(projects).toHaveLength(1);
  expect(projects[0].title).toBe("TypeScript Project");
  });

  it("should paginate discovered projects", async () => {
  const user = await User.create({
    name: "Pagination User",
    email: "pagination@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Project.create([
    {
      title: "Project One",
      description: "First project for pagination testing",
      createdBy: user._id,
      maxMembers: 5,
      status: "open",
    },
    {
      title: "Project Two",
      description: "Second project for pagination testing",
      createdBy: user._id,
      maxMembers: 5,
      status: "open",
    },
    {
      title: "Project Three",
      description: "Third project for pagination testing",
      createdBy: user._id,
      maxMembers: 5,
      status: "open",
    },
  ]);

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .get("/api/projects/discover")
    .query({ page: 1, limit: 2 })
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);

  const result = response.body.data;

  expect(result.projects).toHaveLength(2);
  expect(result.pagination.page).toBe(1);
  expect(result.pagination.limit).toBe(2);
  expect(result.pagination.total).toBe(3);
  expect(result.pagination.hasMore).toBe(true);
  });

  it("should return the correct projects on page 2", async () => {
  const user = await User.create({
    name: "Page Two User",
    email: "page-two@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Project.create([
    {
      title: "Project One",
      description: "First project for page two testing",
      createdBy: user._id,
      maxMembers: 5,
      status: "open",
    },
    {
      title: "Project Two",
      description: "Second project for page two testing",
      createdBy: user._id,
      maxMembers: 5,
      status: "open",
    },
    {
      title: "Project Three",
      description: "Third project for page two testing",
      createdBy: user._id,
      maxMembers: 5,
      status: "open",
    },
  ]);

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .get("/api/projects/discover")
    .query({ page: 2, limit: 2 })
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);

  const result = response.body.data;

  expect(result.projects).toHaveLength(1);
  expect(result.pagination.page).toBe(2);
  expect(result.pagination.limit).toBe(2);
  expect(result.pagination.total).toBe(3);
  expect(result.pagination.hasMore).toBe(false);
  });

  it("should return hasMore false on the last page", async () => {
  const user = await User.create({
    name: "Last Page User",
    email: "last-page@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Project.create([
    {
      title: "Project One",
      description: "First project for last page testing",
      createdBy: user._id,
      maxMembers: 5,
      status: "open",
    },
    {
      title: "Project Two",
      description: "Second project for last page testing",
      createdBy: user._id,
      maxMembers: 5,
      status: "open",
    },
    {
      title: "Project Three",
      description: "Third project for last page testing",
      createdBy: user._id,
      maxMembers: 5,
      status: "open",
    },
    {
      title: "Project Four",
      description: "Fourth project for last page testing",
      createdBy: user._id,
      maxMembers: 5,
      status: "open",
    },
  ]);

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .get("/api/projects/discover")
    .query({ page: 2, limit: 2 })
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);

  const result = response.body.data;

  expect(result.projects).toHaveLength(2);
  expect(result.pagination.page).toBe(2);
  expect(result.pagination.limit).toBe(2);
  expect(result.pagination.total).toBe(4);
  expect(result.pagination.hasMore).toBe(false);
  });

  it("should return an empty result when no project matches the skill", async () => {
  const user = await User.create({
    name: "No Match User",
    email: "no-match@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Project.create({
    title: "TypeScript Project",
    description: "A project looking for TypeScript developers",
    createdBy: user._id,
    skillsNeeded: ["TypeScript", "MongoDB"],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .get("/api/projects/discover")
    .query({ skill: "Rust" })
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const result = response.body.data;

  expect(result.projects).toHaveLength(0);
  expect(result.pagination.total).toBe(0);
  expect(result.pagination.hasMore).toBe(false);
  });

  it("should not allow unauthenticated users to discover projects", async () => {
  const response = await request(app)
    .get("/api/projects/discover");

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
  });

  it("should safely handle regex characters in skill search", async () => {
  const user = await User.create({
    name: "Regex User",
    email: "regex@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Project.create({
    title: "TypeScript Project",
    description: "A project looking for TypeScript developers",
    createdBy: user._id,
    skillsNeeded: ["TypeScript"],
    maxMembers: 5,
    status: "open",
  });

  await Project.create({
    title: "Python Project",
    description: "A project looking for Python developers",
    createdBy: user._id,
    skillsNeeded: ["Python"],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .get("/api/projects/discover")
    .query({ skill: ".*" })
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const result = response.body.data;

  expect(result.projects).toHaveLength(0);
  expect(result.pagination.total).toBe(0);
  });

  it("should reject a skill longer than 50 characters", async () => {
  const user = await User.create({
    name: "Skill Validation User",
    email: "skill-validation@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const longSkill = "a".repeat(51);

  const response = await request(app)
    .get("/api/projects/discover")
    .query({ skill: longSkill })
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  });

  it("should reject an empty skill query", async () => {
  const user = await User.create({
    name: "Empty Skill User",
    email: "empty-skill@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .get("/api/projects/discover")
    .query({ skill: "" })
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  });

  it("should return projects created by the authenticated user", async () => {
  const user = await User.create({
    name: "Project Owner",
    email: "project-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "My Created Project",
    description: "A project created by the authenticated user",
    createdBy: user._id,
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .get("/api/projects/my")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const result = response.body.data;

  expect(result.created).toHaveLength(1);
  expect(result.created[0]._id).toBe(project._id.toString());
  expect(result.created[0].title).toBe("My Created Project");

  expect(result.joined).toHaveLength(0);
  });

  it("should return projects joined by the authenticated user", async () => {
  const owner = await User.create({
    name: "Project Owner",
    email: "joined-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const member = await User.create({
    name: "Project Member",
    email: "joined-member@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Joined Project",
    description: "A project joined by the authenticated user",
    createdBy: owner._id,
    members: [
      {
        userId: owner._id,
        role: "owner",
      },
      {
        userId: member._id,
        role: "member",
      },
    ],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: member._id.toString(),
    role: member.role,
  });

  const response = await request(app)
    .get("/api/projects/my")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const result = response.body.data;

  expect(result.created).toHaveLength(0);
  expect(result.joined).toHaveLength(1);
  expect(result.joined[0]._id).toBe(project._id.toString());
  expect(result.joined[0].title).toBe("Joined Project");
  });

  it("should return only projects related to the authenticated user", async () => {
  const userA = await User.create({
    name: "User A",
    email: "user-a@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const userB = await User.create({
    name: "User B",
    email: "user-b@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  await Project.create({
    title: "User A Project",
    description: "Project created by User A",
    createdBy: userA._id,
    members: [{ userId: userA._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  await Project.create({
    title: "User B Project",
    description: "Project created by User B",
    createdBy: userB._id,
    members: [{ userId: userB._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: userA._id.toString(),
    role: userA.role,
  });

  const response = await request(app)
    .get("/api/projects/my")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const result = response.body.data;

  expect(result.created).toHaveLength(1);
  expect(result.created[0].title).toBe("User A Project");

  expect(result.created.some((project: any) =>
    project.title === "User B Project"
  )).toBe(false);

  expect(result.joined).toHaveLength(0);
  });

  it("should not allow unauthenticated users to access my projects", async () => {
  const response = await request(app)
    .get("/api/projects/my");

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
  });

  it("should allow a user to request to join an open project", async () => {
  const owner = await User.create({
    name: "Project Owner",
    email: "join-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user = await User.create({
    name: "Project User",
    email: "join-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Open Collaboration Project",
    description: "A project open for new members",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .post(`/api/projects/${project._id}/join`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);

  const joinRequest = response.body.data;

  expect(joinRequest.projectId).toBe(project._id.toString());
  expect(joinRequest.userId).toBe(user._id.toString());
  });

  it("should return 404 when joining a non-existing project", async () => {
  const user = await User.create({
    name: "Join User",
    email: "join-missing@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const fakeProjectId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .post(`/api/projects/${fakeProjectId}/join`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);
  });

  it("should not allow a user to join a closed project", async () => {
  const owner = await User.create({
    name: "Closed Project Owner",
    email: "closed-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user = await User.create({
    name: "Closed Project User",
    email: "closed-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Closed Project",
    description: "This project is not accepting new members",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "closed",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .post(`/api/projects/${project._id}/join`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const joinRequestCount = await ProjectJoinRequest.countDocuments({
    projectId: project._id,
    userId: user._id,
  });

  expect(joinRequestCount).toBe(0);
  });

  it("should not allow an existing member to request to join again", async () => {
  const owner = await User.create({
    name: "Member Owner",
    email: "member-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const member = await User.create({
    name: "Existing Member",
    email: "existing-member@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Existing Member Project",
    description: "A project where the user is already a member",
    createdBy: owner._id,
    members: [
      {
        userId: owner._id,
        role: "owner",
      },
      {
        userId: member._id,
        role: "member",
      },
    ],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: member._id.toString(),
    role: member.role,
  });

  const response = await request(app)
    .post(`/api/projects/${project._id}/join`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const joinRequestCount = await ProjectJoinRequest.countDocuments({
    projectId: project._id,
    userId: member._id,
  });

  expect(joinRequestCount).toBe(0);
  });

  it("should not allow a duplicate join request", async () => {
  const owner = await User.create({
    name: "Duplicate Owner",
    email: "duplicate-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user = await User.create({
    name: "Duplicate User",
    email: "duplicate-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Duplicate Request Project",
    description: "A project for duplicate request testing",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const firstResponse = await request(app)
    .post(`/api/projects/${project._id}/join`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(firstResponse.status).toBe(201);

  const secondResponse = await request(app)
    .post(`/api/projects/${project._id}/join`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(secondResponse.status).toBe(400);
  expect(secondResponse.body.success).toBe(false);

  const requestCount = await ProjectJoinRequest.countDocuments({
    projectId: project._id,
    userId: user._id,
  });

  expect(requestCount).toBe(1);
  });

  it("should not allow an unauthenticated user to request to join a project", async () => {
  const owner = await User.create({
    name: "Auth Owner",
    email: "auth-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Protected Join Project",
    description: "A project protected by authentication",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const response = await request(app)
    .post(`/api/projects/${project._id}/join`);

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);

  const requestCount = await ProjectJoinRequest.countDocuments({
    projectId: project._id,
  });

  expect(requestCount).toBe(0);
  });

  it("should reject an invalid project ID when joining", async () => {
  const user = await User.create({
    name: "Invalid ID User",
    email: "invalid-project-id@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .post("/api/projects/not-a-valid-id/join")
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  });

  it("should not allow the project owner to request to join their own project", async () => {
  const owner = await User.create({
    name: "Self Join Owner",
    email: "self-join-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Owner Project",
    description: "A project owned by the authenticated user",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: owner._id.toString(),
    role: owner.role,
  });

  const response = await request(app)
    .post(`/api/projects/${project._id}/join`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const requestCount = await ProjectJoinRequest.countDocuments({
    projectId: project._id,
    userId: owner._id,
  });

  expect(requestCount).toBe(0);
  });

  it("should not allow a user to join a full project", async () => {
  const owner = await User.create({
    name: "Full Project Owner",
    email: "full-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const member = await User.create({
    name: "Full Project Member",
    email: "full-member@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user = await User.create({
    name: "Waiting User",
    email: "waiting-user@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Full Project",
    description: "A project that has reached its member limit",
    createdBy: owner._id,
    members: [
      {
        userId: owner._id,
        role: "owner",
      },
      {
        userId: member._id,
        role: "member",
      },
    ],
    maxMembers: 2,
    status: "closed",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .post(`/api/projects/${project._id}/join`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const requestCount = await ProjectJoinRequest.countDocuments({
    projectId: project._id,
    userId: user._id,
  });

  expect(requestCount).toBe(0);
  });

  it("should allow the project owner to view pending join requests", async () => {
  const owner = await User.create({
    name: "Requests Owner",
    email: "requests-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const requester = await User.create({
    name: "Project Requester",
    email: "project-requester@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Requests Project",
    description: "A project with a pending join request",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  await ProjectJoinRequest.create({
    projectId: project._id,
    userId: requester._id,
  });

  const accessToken = generateAccessToken({
    userId: owner._id.toString(),
    role: owner.role,
  });

  const response = await request(app)
    .get(`/api/projects/${project._id}/requests`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const requests = response.body.data;

  expect(requests).toHaveLength(1);
  expect(requests[0].projectId).toBe(project._id.toString());
  expect(requests[0].userId._id).toBe(requester._id.toString());
  expect(requests[0].userId.name).toBe("Project Requester");
  });

  it("should not allow a non-owner to view pending join requests", async () => {
  const owner = await User.create({
    name: "Requests Owner",
    email: "requests-owner-2@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const user = await User.create({
    name: "Non Owner User",
    email: "non-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const requester = await User.create({
    name: "Another Requester",
    email: "another-requester@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Private Requests Project",
    description: "A project with private pending requests",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  await ProjectJoinRequest.create({
    projectId: project._id,
    userId: requester._id,
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = await request(app)
    .get(`/api/projects/${project._id}/requests`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(403);
  expect(response.body.success).toBe(false);
  });

  it("should reject invalid request ID when accepting", async () => {
  const owner = await User.create({
    name: "Accept Owner",
    email: "accept-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: owner._id.toString(),
    role: owner.role,
  });

  const response = await request(app)
    .put(`/api/projects/507f1f77bcf86cd799439011/requests/invalid-request-id/accept`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  });

  it("should return 404 when accepting a non-existing join request", async () => {
  const owner = await User.create({
    name: "Missing Request Owner",
    email: "missing-request-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Missing Request Project",
    description: "Testing a missing join request",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: owner._id.toString(),
    role: owner.role,
  });

  const nonExistingRequestId = new mongoose.Types.ObjectId();

  const response = await request(app)
    .put(
      `/api/projects/${project._id}/requests/${nonExistingRequestId}/accept`
    )
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);
  });

  it("should not allow a non-owner to accept a join request", async () => {
  const owner = await User.create({
    name: "Project Owner",
    email: "accept-auth-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const requester = await User.create({
    name: "Requester",
    email: "accept-auth-requester@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const nonOwner = await User.create({
    name: "Non Owner",
    email: "accept-auth-non-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Authorization Test Project",
    description: "Testing project request authorization",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const joinRequest = await ProjectJoinRequest.create({
    projectId: project._id,
    userId: requester._id,
  });

  const accessToken = generateAccessToken({
    userId: nonOwner._id.toString(),
    role: nonOwner.role,
  });

  const response = await request(app)
    .put(
      `/api/projects/${project._id}/requests/${joinRequest._id}/accept`
    )
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(403);
  expect(response.body.success).toBe(false);

  const requestStillPending = await ProjectJoinRequest.findById(
    joinRequest._id
  );

  expect(requestStillPending).not.toBeNull();
  });

  it("should not allow the requester to accept their own join request", async () => {
  const owner = await User.create({
    name: "Self Accept Owner",
    email: "self-accept-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const requester = await User.create({
    name: "Self Accept Requester",
    email: "self-accept-requester@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Self Accept Project",
    description: "Testing requester authorization",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const joinRequest = await ProjectJoinRequest.create({
    projectId: project._id,
    userId: requester._id,
  });

  const accessToken = generateAccessToken({
    userId: requester._id.toString(),
    role: requester.role,
  });

  const response = await request(app)
    .put(
      `/api/projects/${project._id}/requests/${joinRequest._id}/accept`
    )
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(403);
  expect(response.body.success).toBe(false);

  const requestStillPending = await ProjectJoinRequest.findById(
    joinRequest._id
  );

  expect(requestStillPending).not.toBeNull();
  });

  it("should not allow an unauthenticated user to reject a join request", async () => {
  const owner = await User.create({
    name: "Reject Auth Owner",
    email: "reject-auth-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const requester = await User.create({
    name: "Reject Auth Requester",
    email: "reject-auth-requester@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Reject Auth Project",
    description: "Testing unauthenticated rejection",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const joinRequest = await ProjectJoinRequest.create({
    projectId: project._id,
    userId: requester._id,
  });

  const response = await request(app).delete(
    `/api/projects/${project._id}/requests/${joinRequest._id}/reject`
  );

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);

  const requestStillPending = await ProjectJoinRequest.findById(
    joinRequest._id
  );

  expect(requestStillPending).not.toBeNull();
  });

  it("should not allow a non-owner to reject a join request", async () => {
  const owner = await User.create({
    name: "Reject Owner",
    email: "reject-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const requester = await User.create({
    name: "Reject Requester",
    email: "reject-requester@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const nonOwner = await User.create({
    name: "Reject Non Owner",
    email: "reject-non-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Reject Authorization Project",
    description: "Testing rejection authorization",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const joinRequest = await ProjectJoinRequest.create({
    projectId: project._id,
    userId: requester._id,
  });

  const accessToken = generateAccessToken({
    userId: nonOwner._id.toString(),
    role: nonOwner.role,
  });

  const response = await request(app)
    .delete(
      `/api/projects/${project._id}/requests/${joinRequest._id}/reject`
    )
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(403);
  expect(response.body.success).toBe(false);

  const requestStillPending = await ProjectJoinRequest.findById(
    joinRequest._id
  );

  expect(requestStillPending).not.toBeNull();
  });

  it("should add the requester as a project member when owner accepts the request", async () => {
  const owner = await User.create({
    name: "Accept Flow Owner",
    email: "accept-flow-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const requester = await User.create({
    name: "Accept Flow Requester",
    email: "accept-flow-requester@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Accept Flow Project",
    description: "Testing successful request acceptance",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const joinRequest = await ProjectJoinRequest.create({
    projectId: project._id,
    userId: requester._id,
  });

  const accessToken = generateAccessToken({
    userId: owner._id.toString(),
    role: owner.role,
  });

  const response = await request(app)
    .put(
      `/api/projects/${project._id}/requests/${joinRequest._id}/accept`
    )
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);

  const updatedProject = await Project.findById(project._id);

  expect(updatedProject).not.toBeNull();

  const newMember = updatedProject!.members.find(
    (member) => member.userId.toString() === requester._id.toString()
  );

  expect(newMember).toBeDefined();
  expect(newMember!.role).toBe("member");

  const deletedRequest = await ProjectJoinRequest.findById(joinRequest._id);

  expect(deletedRequest).toBeNull();
  });

  it("should close the project when accepting a request reaches max members", async () => {
  const owner = await User.create({
    name: "Full Project Owner",
    email: "full-project-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const requester = await User.create({
    name: "Full Project Requester",
    email: "full-project-requester@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Full Project",
    description: "Testing project closing at max members",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 2,
    status: "open",
  });

  const joinRequest = await ProjectJoinRequest.create({
    projectId: project._id,
    userId: requester._id,
  });

  const accessToken = generateAccessToken({
    userId: owner._id.toString(),
    role: owner.role,
  });

  const response = await request(app)
    .put(
      `/api/projects/${project._id}/requests/${joinRequest._id}/accept`
    )
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);

  const updatedProject = await Project.findById(project._id);

  expect(updatedProject).not.toBeNull();
  expect(updatedProject!.members).toHaveLength(2);
  expect(updatedProject!.status).toBe("closed");

  const deletedRequest = await ProjectJoinRequest.findById(joinRequest._id);

  expect(deletedRequest).toBeNull();
  });

  it("should delete the join request when the owner rejects it", async () => {
  const owner = await User.create({
    name: "Reject Flow Owner",
    email: "reject-flow-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const requester = await User.create({
    name: "Reject Flow Requester",
    email: "reject-flow-requester@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Reject Flow Project",
    description: "Testing successful request rejection",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const joinRequest = await ProjectJoinRequest.create({
    projectId: project._id,
    userId: requester._id,
  });

  const accessToken = generateAccessToken({
    userId: owner._id.toString(),
    role: owner.role,
  });

  const response = await request(app)
    .delete(
      `/api/projects/${project._id}/requests/${joinRequest._id}/reject`
    )
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);

  const deletedRequest = await ProjectJoinRequest.findById(joinRequest._id);

  expect(deletedRequest).toBeNull();

  const updatedProject = await Project.findById(project._id);

  expect(updatedProject!.members).toHaveLength(1);
  });

  it("should allow a member to leave the project", async () => {
  const owner = await User.create({
    name: "Leave Owner",
    email: "leave-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const member = await User.create({
    name: "Leave Member",
    email: "leave-member@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Leave Project",
    description: "Testing member leaving the project",
    createdBy: owner._id,
    members: [
      { userId: owner._id, role: "owner" },
      { userId: member._id, role: "member" },
    ],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: member._id.toString(),
    role: member.role,
  });

  const response = await request(app)
    .post(`/api/projects/${project._id}/leave`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);

  const updatedProject = await Project.findById(project._id);

  expect(updatedProject).not.toBeNull();
  expect(updatedProject!.members).toHaveLength(1);

  expect(
    updatedProject!.members.some(
      (m) => m.userId.toString() === member._id.toString()
    )
  ).toBe(false);

  expect(
    updatedProject!.members.some(
      (m) => m.userId.toString() === owner._id.toString()
    )
  ).toBe(true);
  });

  it("should not allow the project owner to leave directly", async () => {
  const owner = await User.create({
    name: "Owner Leave Test",
    email: "owner-leave-test@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Owner Leave Project",
    description: "Testing owner cannot leave directly",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: owner._id.toString(),
    role: owner.role,
  });

  const response = await request(app)
    .post(`/api/projects/${project._id}/leave`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const unchangedProject = await Project.findById(project._id);

  expect(unchangedProject).not.toBeNull();
  expect(unchangedProject!.members).toHaveLength(1);
  expect(unchangedProject!.members[0].userId.toString()).toBe(
    owner._id.toString()
  );
  expect(unchangedProject!.createdBy.toString()).toBe(
    owner._id.toString()
  );
  });

  it("should reopen a full project when a member leaves", async () => {
  const owner = await User.create({
    name: "Full Project Owner",
    email: "full-leave-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const member = await User.create({
    name: "Full Project Member",
    email: "full-leave-member@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Reopen Project",
    description: "Testing project reopening after member leaves",
    createdBy: owner._id,
    members: [
      { userId: owner._id, role: "owner" },
      { userId: member._id, role: "member" },
    ],
    maxMembers: 2,
    status: "closed",
  });

  const accessToken = generateAccessToken({
    userId: member._id.toString(),
    role: member.role,
  });

  const response = await request(app)
    .post(`/api/projects/${project._id}/leave`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);

  const updatedProject = await Project.findById(project._id);

  expect(updatedProject).not.toBeNull();
  expect(updatedProject!.members).toHaveLength(1);
  expect(updatedProject!.status).toBe("open");

  expect(
    updatedProject!.members.some(
      (m) => m.userId.toString() === member._id.toString()
    )
  ).toBe(false);
  });

  it("should allow the project owner to remove a member", async () => {
  const owner = await User.create({
    name: "Remove Owner",
    email: "remove-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const member = await User.create({
    name: "Remove Member",
    email: "remove-member@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Remove Member Project",
    description: "Testing owner removing a member",
    createdBy: owner._id,
    members: [
      { userId: owner._id, role: "owner" },
      { userId: member._id, role: "member" },
    ],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: owner._id.toString(),
    role: owner.role,
  });

  const response = await request(app)
    .delete(`/api/projects/${project._id}/members/${member._id}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);

  const updatedProject = await Project.findById(project._id);

  expect(updatedProject).not.toBeNull();
  expect(updatedProject!.members).toHaveLength(1);

  expect(
    updatedProject!.members.some(
      (m) => m.userId.toString() === member._id.toString()
    )
  ).toBe(false);

  expect(
    updatedProject!.members.some(
      (m) => m.userId.toString() === owner._id.toString()
    )
  ).toBe(true);
  });

  it("should not allow a non-owner to remove a project member", async () => {
  const owner = await User.create({
    name: "Remove Auth Owner",
    email: "remove-auth-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const member = await User.create({
    name: "Remove Auth Member",
    email: "remove-auth-member@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const nonOwner = await User.create({
    name: "Remove Auth Non Owner",
    email: "remove-auth-non-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Remove Authorization Project",
    description: "Testing member removal authorization",
    createdBy: owner._id,
    members: [
      { userId: owner._id, role: "owner" },
      { userId: member._id, role: "member" },
      { userId: nonOwner._id, role: "member" },
    ],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: nonOwner._id.toString(),
    role: nonOwner.role,
  });

  const response = await request(app)
    .delete(`/api/projects/${project._id}/members/${member._id}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(403);
  expect(response.body.success).toBe(false);

  const unchangedProject = await Project.findById(project._id);

  expect(unchangedProject).not.toBeNull();
  expect(
    unchangedProject!.members.some(
      (m) => m.userId.toString() === member._id.toString()
    )
  ).toBe(true);
  });

  it("should transfer project ownership to an existing member", async () => {
  const currentOwner = await User.create({
    name: "Current Owner",
    email: "transfer-current-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const newOwner = await User.create({
    name: "New Owner",
    email: "transfer-new-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Transfer Ownership Project",
    description: "Testing ownership transfer",
    createdBy: currentOwner._id,
    members: [
      { userId: currentOwner._id, role: "owner" },
      { userId: newOwner._id, role: "member" },
    ],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: currentOwner._id.toString(),
    role: currentOwner.role,
  });

  const response = await request(app)
    .put(`/api/projects/${project._id}/transfer-ownership`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      newOwnerId: newOwner._id.toString(),
    });

  expect(response.status).toBe(200);

  const updatedProject = await Project.findById(project._id);

  expect(updatedProject).not.toBeNull();

  expect(updatedProject!.createdBy.toString()).toBe(
    newOwner._id.toString()
  );

  const oldOwnerMember = updatedProject!.members.find(
    (m) => m.userId.toString() === currentOwner._id.toString()
  );

  const newOwnerMember = updatedProject!.members.find(
    (m) => m.userId.toString() === newOwner._id.toString()
  );

  expect(oldOwnerMember!.role).toBe("member");
  expect(newOwnerMember!.role).toBe("owner");
  });

  it("should not allow a non-owner to transfer project ownership", async () => {
  const owner = await User.create({
    name: "Transfer Auth Owner",
    email: "transfer-auth-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const member = await User.create({
    name: "Transfer Auth Member",
    email: "transfer-auth-member@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const newOwner = await User.create({
    name: "Transfer Auth New Owner",
    email: "transfer-auth-new-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Transfer Authorization Project",
    description: "Testing ownership transfer authorization",
    createdBy: owner._id,
    members: [
      { userId: owner._id, role: "owner" },
      { userId: member._id, role: "member" },
      { userId: newOwner._id, role: "member" },
    ],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: member._id.toString(),
    role: member.role,
  });

  const response = await request(app)
    .put(`/api/projects/${project._id}/transfer-ownership`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      newOwnerId: newOwner._id.toString(),
    });

  expect(response.status).toBe(403);
  expect(response.body.success).toBe(false);

  const unchangedProject = await Project.findById(project._id);

  expect(unchangedProject).not.toBeNull();
  expect(unchangedProject!.createdBy.toString()).toBe(
    owner._id.toString()
  );

  expect(
    unchangedProject!.members.find(
      (m) => m.userId.toString() === owner._id.toString()
    )!.role
  ).toBe("owner");

  expect(
    unchangedProject!.members.find(
      (m) => m.userId.toString() === newOwner._id.toString()
    )!.role
  ).toBe("member");
  });

  it("should not transfer ownership to a user who is not a project member", async () => {
  const owner = await User.create({
    name: "Transfer Member Owner",
    email: "transfer-member-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const outsider = await User.create({
    name: "Transfer Outsider",
    email: "transfer-outsider@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Transfer Member Project",
    description: "Testing transfer to non member",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: owner._id.toString(),
    role: owner.role,
  });

  const response = await request(app)
    .put(`/api/projects/${project._id}/transfer-ownership`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      newOwnerId: outsider._id.toString(),
    });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);

  const unchangedProject = await Project.findById(project._id);

  expect(unchangedProject).not.toBeNull();
  expect(unchangedProject!.createdBy.toString()).toBe(
    owner._id.toString()
  );

  expect(unchangedProject!.members).toHaveLength(1);
  });

  it("should allow the project owner to delete the project", async () => {
  const owner = await User.create({
    name: "Delete Owner",
    email: "delete-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Delete Project",
    description: "Testing project deletion",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: owner._id.toString(),
    role: owner.role,
  });

  const response = await request(app)
    .delete(`/api/projects/${project._id}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const deletedProject = await Project.findById(project._id);

  expect(deletedProject).toBeNull();
  });

  it("should not allow a non-owner to delete the project", async () => {
  const owner = await User.create({
    name: "Delete Auth Owner",
    email: "delete-auth-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const member = await User.create({
    name: "Delete Auth Member",
    email: "delete-auth-member@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Delete Authorization Project",
    description: "Testing project deletion authorization",
    createdBy: owner._id,
    members: [
      { userId: owner._id, role: "owner" },
      { userId: member._id, role: "member" },
    ],
    maxMembers: 5,
    status: "open",
  });

  const accessToken = generateAccessToken({
    userId: member._id.toString(),
    role: member.role,
  });

  const response = await request(app)
    .delete(`/api/projects/${project._id}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(403);
  expect(response.body.success).toBe(false);

  const unchangedProject = await Project.findById(project._id);

  expect(unchangedProject).not.toBeNull();
  });

  it("should remove pending join requests when the project is deleted", async () => {
  const owner = await User.create({
    name: "Delete Cleanup Owner",
    email: "delete-cleanup-owner@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const requester = await User.create({
    name: "Delete Cleanup Requester",
    email: "delete-cleanup-requester@test.com",
    passwordHash: "hashed-password",
    authMethod: "email",
  });

  const project = await Project.create({
    title: "Delete Cleanup Project",
    description: "Testing pending request cleanup",
    createdBy: owner._id,
    members: [{ userId: owner._id, role: "owner" }],
    maxMembers: 5,
    status: "open",
  });

  await ProjectJoinRequest.create({
    projectId: project._id,
    userId: requester._id,
  });

  const accessToken = generateAccessToken({
    userId: owner._id.toString(),
    role: owner.role,
  });

  const response = await request(app)
    .delete(`/api/projects/${project._id}`)
    .set("Authorization", `Bearer ${accessToken}`);

  expect(response.status).toBe(200);

  const deletedProject = await Project.findById(project._id);
  const remainingRequests = await ProjectJoinRequest.countDocuments({
    projectId: project._id,
  });

  expect(deletedProject).toBeNull();
  expect(remainingRequests).toBe(0);
  });
});