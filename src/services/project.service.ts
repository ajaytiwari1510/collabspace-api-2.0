import { Project } from "../models/project.model.js";
import { ProjectJoinRequest } from "../models/projectJoinRequest.model.js";
import { ApiError } from "../utils/apiError.util.js";
import type { CreateProjectInput } from "../validators/project.validator.js";

export const createProject = async (userId: string, input: CreateProjectInput) => {
  const project = await Project.create({
    ...input,
    createdBy: userId,
    members: [{ userId, role: "owner" }],
  });

  return project;
};

export const requestToJoin = async (projectId: string, userId: string) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  if (project.status !== "open") {
    throw new ApiError(400, "This project is not accepting new members");
  }

  const isAlreadyMember = project.members.some(
    (m) => m.userId.toString() === userId
  );
  if (isAlreadyMember) {
    throw new ApiError(400, "You are already a member of this project");
  }

  const existingRequest = await ProjectJoinRequest.findOne({ projectId, userId });
  if (existingRequest) {
    throw new ApiError(400, "You have already requested to join this project");
  }

  const request = await ProjectJoinRequest.create({ projectId, userId });
  return request;
};

export const acceptJoinRequest = async (requestId: string, ownerId: string) => {
  const request = await ProjectJoinRequest.findById(requestId);
  if (!request) {
    throw new ApiError(404, "Join request not found");
  }

  const project = await Project.findById(request.projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  if (project.createdBy.toString() !== ownerId) {
    throw new ApiError(403, "Only the project owner can accept requests");
  }

  if (project.members.length >= project.maxMembers) {
    throw new ApiError(400, "Project has reached maximum member limit");
  }

  project.members.push({ userId: request.userId, role: "member", joinedAt: new Date() });

  if (project.members.length >= project.maxMembers) {
    project.status = "closed";
  }

  await project.save();
  await ProjectJoinRequest.findByIdAndDelete(requestId);

  return project;
};

export const rejectJoinRequest = async (requestId: string, ownerId: string) => {
  const request = await ProjectJoinRequest.findById(requestId);
  if (!request) {
    throw new ApiError(404, "Join request not found");
  }

  const project = await Project.findById(request.projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  if (project.createdBy.toString() !== ownerId) {
    throw new ApiError(403, "Only the project owner can reject requests");
  }

  await ProjectJoinRequest.findByIdAndDelete(requestId);
  return { message: "Join request rejected" };
};

export const leaveProject = async (projectId: string, userId: string) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const member = project.members.find((m) => m.userId.toString() === userId);
  if (!member) {
    throw new ApiError(400, "You are not a member of this project");
  }

  if (member.role === "owner") {
    throw new ApiError(
      400,
      "As the owner, you cannot leave directly. Transfer ownership or delete the project instead."
    );
  }

  const wasClosedDueToFull = project.status === "closed" && project.members.length >= project.maxMembers;

  project.members = project.members.filter((m) => m.userId.toString() !== userId);

  if (wasClosedDueToFull) {
    project.status = "open";
  }

  await project.save();
  return { message: "You have left the project" };
};

export const removeMember = async (projectId: string, memberIdToRemove: string, ownerId: string) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  if (project.createdBy.toString() !== ownerId) {
    throw new ApiError(403, "Only the project owner can remove members");
  }

  if (memberIdToRemove === ownerId) {
    throw new ApiError(400, "Owner cannot remove themselves. Use leave/delete options instead.");
  }

  const memberExists = project.members.some((m) => m.userId.toString() === memberIdToRemove);
  if (!memberExists) {
    throw new ApiError(404, "This user is not a member of the project");
  }

  const wasClosedDueToFull = project.status === "closed" && project.members.length >= project.maxMembers;

  project.members = project.members.filter((m) => m.userId.toString() !== memberIdToRemove);

  if (wasClosedDueToFull) {
    project.status = "open";
  }

  await project.save();
  return { message: "Member removed successfully" };
};

export const discoverProjects = async (
  page: number,
  limit: number,
  skillFilter?: string
) => {
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = { status: "open" };
  if (skillFilter) {
    query.skillsNeeded = { $regex: skillFilter, $options: "i" };
  }

  const projects = await Project.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("createdBy", "name");

  const total = await Project.countDocuments(query);

  return {
    projects,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + projects.length < total,
    },
  };
};

export const getMyProjects = async (userId: string) => {
  const created = await Project.find({ createdBy: userId }).sort({ createdAt: -1 });

  const joined = await Project.find({
    "members.userId": userId,
    createdBy: { $ne: userId },
  }).sort({ createdAt: -1 });

  return { created, joined };
};

export const getPendingRequestsForOwner = async (projectId: string, ownerId: string) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  if (project.createdBy.toString() !== ownerId) {
    throw new ApiError(403, "Only the project owner can view join requests");
  }

  const requests = await ProjectJoinRequest.find({ projectId }).populate("userId", "name");
  return requests;
};

export const transferOwnership = async (
  projectId: string,
  currentOwnerId: string,
  newOwnerId: string
) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  if (project.createdBy.toString() !== currentOwnerId) {
    throw new ApiError(403, "Only the current owner can transfer ownership");
  }

  const newOwnerMember = project.members.find(
    (m) => m.userId.toString() === newOwnerId
  );
  if (!newOwnerMember) {
    throw new ApiError(400, "The new owner must be an existing member of the project");
  }

  project.members = project.members.map((m) => {
    if (m.userId.toString() === currentOwnerId) {
      return { ...m, role: "member" as const };
    }
    if (m.userId.toString() === newOwnerId) {
      return { ...m, role: "owner" as const };
    }
    return m;
  });

  project.createdBy = newOwnerMember.userId;

  await project.save();
  return project;
};

export const deleteProject = async (projectId: string, userId: string) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  if (project.createdBy.toString() !== userId) {
    throw new ApiError(403, "Only the project owner can delete this project");
  }

  await Project.findByIdAndDelete(projectId);
  await ProjectJoinRequest.deleteMany({ projectId });

  return { message: "Project deleted successfully" };
};