import { User } from "../models/user.model.js";
import { hashPassword, comparePassword } from "../utils/password.util.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.util.js";
import { verifyRefreshToken } from "../utils/jwt.util.js"; 
import { ApiError } from "../utils/apiError.util.js";
import type { RegisterInput, LoginInput } from "../validators/auth.validator.js";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

export const registerUser = async (input: RegisterInput) => {
  // Step 1: Check duplicate email
  const existingUser = await User.findOne({ email: input.email });
  if (existingUser) {
    throw new ApiError(400, "Email already registered");
  }

  // Step 2: Hash password
  const passwordHash = await hashPassword(input.password);

  // Step 3: Create user
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash,
    authMethod: "email",
  });

  // Step 4: Generate tokens
  const accessToken = generateAccessToken({ userId: user._id.toString(), role: user.role });
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
  // Step 1: Find user, explicitly include passwordHash (select: false hai model me)
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Step 2: Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new ApiError(403, `Account locked. Try again in ${minutesLeft} minutes`);
  }

  // Step 3: Compare password
  const isPasswordValid = await comparePassword(input.password, user.passwordHash || "");

  if (!isPasswordValid) {
    user.loginFailCount += 1;

    if (user.loginFailCount >= MAX_LOGIN_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
    }

    await user.save();
    throw new ApiError(401, "Invalid credentials");
  }

  // Step 4: Successful login - reset lockout state
  user.loginFailCount = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  // Step 5: Generate tokens
  const accessToken = generateAccessToken({ userId: user._id.toString(), role: user.role });
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
  // Step 1: Refresh token verify karo
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  // Step 2: User ko DB se confirm karo (abhi bhi exist karta hai, banned nahi hai)
  const user = await User.findById(decoded.userId);
  if (!user) {
    throw new ApiError(401, "User no longer exists");
  }
  if (user.isBanned) {
    throw new ApiError(403, "Account is banned");
  }

  // NAYA CHECK: token version match karta hai kya current version se
  if (decoded.tokenVersion !== user.refreshTokenVersion) {
    throw new ApiError(401, "Token has been revoked, please login again");
  }

  // Step 3: Naya access token generate karo
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

  user.refreshTokenVersion += 1; // saare purane refresh tokens invalidate ho gaye
  await user.save();

  return { message: "Logged out successfully" };
};