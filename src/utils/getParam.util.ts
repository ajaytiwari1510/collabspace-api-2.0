import mongoose from "mongoose";
import { ApiError } from "./apiError.util.js";

export const getParam = (value: unknown, name: string): string => {
  if (!value || typeof value !== "string") {
    throw new ApiError(400, `${name} is required`);
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `Invalid ${name}`);
  }

  return value;
};