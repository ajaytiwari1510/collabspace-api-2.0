import { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodType } from "zod";

export const validate = (schema: ZodType): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
};