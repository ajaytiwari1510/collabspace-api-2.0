import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import {
  refreshAccessToken,
  registerUser,
  loginUser,
  logoutUser,
} from "../services/auth.service.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.util.js";

const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await registerUser(req.body);

  res.cookie("refreshToken", result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await loginUser(req.body);

  res.cookie("refreshToken", result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    throw new ApiError(401, "No refresh token provided");
  }

  const result = await refreshAccessToken(refreshToken);

  res.status(200).json({
    success: true,
    message: "Access token refreshed",
    data: result,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  await logoutUser(userId);

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});