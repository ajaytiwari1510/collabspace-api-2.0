import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/apiError.util.js";
import mongoose from "mongoose";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Case 1: Humara khud ka ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Case 2: ZodError - request input validation fail hui
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.issues,
    });
  }

  // Case 3: Mongoose CastError - galat ID format
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // Case 4: Mongoose ValidationError - schema validation fail hui
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);

    return res.status(400).json({
      success: false,
      message: messages.join(", "),
    });
  }

  // Case 5: MongoDB duplicate key error
  if (err.name === "MongoServerError" && (err as any).code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate value - this record already exists",
    });
  }

  // Case 6: Multer error
  if (err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Case 7: Kuch bhi anticipated nahi tha - generic 500
  console.error("Unexpected error:", err);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};