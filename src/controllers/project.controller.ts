import { Request, Response } from "express";
import { getPaginationParams } from "../utils/pagination.util.js";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { createProjectSchema, 
        discoverProjectSchema,
      } from "../validators/project.validator.js";
import { getParam } from "../utils/getParam.util.js";
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


export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const validatedData = createProjectSchema.parse(req.body);

  const project = await createProject(userId, validatedData);

  res.status(201).json({ success: true, message: "Project created", data: project });
});

export const discover = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit);
  const { skill } = discoverProjectSchema.parse(req.query);

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

  const project = await transferOwnership(projectId, currentOwnerId, newOwnerId);

  res.status(200).json({ success: true, message: "Ownership transferred", data: project });
});

export const remove_project = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const projectId = getParam(req.params.id, "Project ID");

  const result = await deleteProject(projectId, userId);

  res.status(200).json({ success: true, message: result.message });
});