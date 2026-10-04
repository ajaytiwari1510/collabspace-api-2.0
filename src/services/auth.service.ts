import { User } from "../models/user.model.js";
import { hashPassword, comparePassword } from "../utils/password.util.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.util.js";
import { ApiError } from "../utils/apiError.util.js";
import type { RegisterInput, LoginInput } from "../validators/auth.validator.js";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;

export const registerUser = async (input: RegisterInput) => {
  const existingUser = await User.findOne({ email: input.email });

  if (existingUser) {
    throw new ApiError(400, "Email already registered");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash,
    authMethod: "email",
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    userId: user._id.toString(),
    role: user.role,
    tokenVersion: user.refreshTokenVersion,
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
};

export const loginUser = async (input: LoginInput) => {
  // passwordHash is excluded by default in the User model.
  const user = await User.findOne({ email: input.email }).select("+passwordHash");

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60000
    );

    throw new ApiError(
      403,
      `Account locked. Try again in ${minutesLeft} minutes`
    );
  }

  const isPasswordValid = await comparePassword(
    input.password,
    user.passwordHash || ""
  );

  if (!isPasswordValid) {
    user.loginFailCount += 1;

    if (user.loginFailCount >= MAX_LOGIN_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
    }

    await user.save();
    throw new ApiError(401, "Invalid credentials");
  }

  user.loginFailCount = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    userId: user._id.toString(),
    role: user.role,
    tokenVersion: user.refreshTokenVersion,
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
};

export const refreshAccessToken = async (refreshToken: string) => {
  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(decoded.userId);

  if (!user) {
    throw new ApiError(401, "User no longer exists");
  }

  if (user.isBanned) {
    throw new ApiError(403, "Account is banned");
  }

  // Changing refreshTokenVersion invalidates previously issued refresh tokens.
  if (decoded.tokenVersion !== user.refreshTokenVersion) {
    throw new ApiError(401, "Token has been revoked, please login again");
  }

  const newAccessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });

  return { accessToken: newAccessToken };
};

export const logoutUser = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Incrementing the version invalidates all existing refresh tokens.
  user.refreshTokenVersion += 1;
  await user.save();

  return { message: "Logged out successfully" };
};

export const getCurrentUser = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
};