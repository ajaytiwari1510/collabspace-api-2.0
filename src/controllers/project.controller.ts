import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { ApiError } from "../utils/apiError.util.js";
import { createProjectSchema } from "../validators/project.validator.js";
import {
  createProject,
  requestToJoin,
  acceptJoinRequest,
  rejectJoinRequest,
  leaveProject,
  removeMember,
  discoverProjects,
  getMyProjects,
  getPendingRequestsForOwner,
  transferOwnership,
  deleteProject,
} from "../services/project.service.js";

const getParam = (value: unknown, name: string): string => {
  if (!value || typeof value !== "string") {
    throw new ApiError(400, `${name} is required`);
  }
  return value;
};

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const validatedData = createProjectSchema.parse(req.body);

  const project = await createProject(userId, validatedData);

  res.status(201).json({ success: true, message: "Project created", data: project });
});

export const discover = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skill = typeof req.query.skill === "string" ? req.query.skill : undefined;

  const result = await discoverProjects(page, limit, skill);

  res.status(200).json({ success: true, data: result });
});

export const myProjects = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const result = await getMyProjects(userId);

  res.status(200).json({ success: true, data: result });
});

export const join = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const projectId = getParam(req.params.id, "Project ID");

  const request = await requestToJoin(projectId, userId);

  res.status(201).json({ success: true, message: "Join request sent", data: request });
});

export const getPendingRequests = asyncHandler(async (req: Request, res: Response) => {
  const ownerId = req.user!.userId;
  const projectId = getParam(req.params.id, "Project ID");

  const requests = await getPendingRequestsForOwner(projectId, ownerId);

  res.status(200).json({ success: true, data: requests });
});

export const accept = asyncHandler(async (req: Request, res: Response) => {
  const ownerId = req.user!.userId;
  const requestId = getParam(req.params.requestId, "Request ID");

  const project = await acceptJoinRequest(requestId, ownerId);

  res.status(200).json({ success: true, message: "Request accepted", data: project });
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const ownerId = req.user!.userId;
  const requestId = getParam(req.params.requestId, "Request ID");

  const result = await rejectJoinRequest(requestId, ownerId);

  res.status(200).json({ success: true, message: result.message });
});

export const leave = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const projectId = getParam(req.params.id, "Project ID");

  const result = await leaveProject(projectId, userId);

  res.status(200).json({ success: true, message: result.message });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const ownerId = req.user!.userId;
  const projectId = getParam(req.params.id, "Project ID");
  const memberId = getParam(req.params.memberId, "Member ID");

  const result = await removeMember(projectId, memberId, ownerId);

  res.status(200).json({ success: true, message: result.message });
});

export const transfer = asyncHandler(async (req: Request, res: Response) => {
  const currentOwnerId = req.user!.userId;
  const projectId = getParam(req.params.id, "Project ID");
  const { newOwnerId } = req.body;

  if (!newOwnerId || typeof newOwnerId !== "string") {
    throw new ApiError(400, "newOwnerId is required");
  }

  const project = await transferOwnership(projectId, currentOwnerId, newOwnerId);

  res.status(200).json({ success: true, message: "Ownership transferred", data: project });
});

export const remove_project = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const projectId = getParam(req.params.id, "Project ID");

  const result = await deleteProject(projectId, userId);

  res.status(200).json({ success: true, message: result.message });
});