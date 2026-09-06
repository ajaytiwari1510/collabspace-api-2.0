import { Project } from "../models/project.model.js";
import { ProjectJoinRequest } from "../models/projectJoinRequest.model.js";
import { ApiError } from "../utils/apiError.util.js";
import type { CreateProjectInput } from "../validators/project.validator.js";
import { createNotification } from "./notification.service.js";
import { User } from "../models/user.model.js";
import { escapeRegex } from "../utils/regex.util.js";


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

  // NAYA CODE - Owner ko notify karo
  const requester = await User.findById(userId);
  await createNotification({
    receiverId: project.createdBy.toString(),
    senderId: userId,
    type: "project_join_request",
    message: `${requester?.name} requested to join your project "${project.title}"`,
    refId: project._id.toString(),
    refModel: "Project",
  });

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

  // NAYA CODE - Requester ko notify karo (delete se PEHLE, kyunki humein request.userId chahiye)
  await createNotification({
    receiverId: request.userId.toString(),
    senderId: ownerId,
    type: "project_request_accepted",
    message: `Your request to join "${project.title}" was accepted`,
    refId: project._id.toString(),
    refModel: "Project",
  });

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

  // NAYA CODE - Requester ko notify karo (delete se PEHLE)
  await createNotification({
    receiverId: request.userId.toString(),
    senderId: ownerId,
    type: "project_request_rejected",
    message: `Your request to join "${project.title}" was declined`,
    refId: project._id.toString(),
    refModel: "Project",
  });

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

  // NAYA CODE - Removed member ko notify karo
  await createNotification({
    receiverId: memberIdToRemove,
    senderId: ownerId,
    type: "removed_from_project",
    message: `You were removed from the project "${project.title}"`,
    refId: project._id.toString(),
    refModel: "Project",
  });

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
    query.skillsNeeded = {
    $regex: escapeRegex(skillFilter),
    $options: "i",
    };
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

  // You cannot transfer ownership to yourself.
  if (currentOwnerId === newOwnerId) {
    throw new ApiError(400, "You are already the owner of this project");
  }

  const newOwnerMember = project.members.find(
    (m) => m.userId.toString() === newOwnerId
  );

  if (!newOwnerMember) {
    throw new ApiError(
      400,
      "The new owner must be an existing member of the project"
    );
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

  // Notify the new owner after successful transfer.
  await createNotification({
    receiverId: newOwnerId,
    senderId: currentOwnerId,
    type: "ownership_transferred",
    message: `You are now the owner of the project "${project.title}"`,
    refId: project._id.toString(),
    refModel: "Project",
  });

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