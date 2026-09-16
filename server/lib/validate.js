import { ZodError } from "zod";
import { AppError } from "./customError.js";

export function validateBody(schema) {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body ?? {});
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new AppError(400, err.errors.map((e) => e.message).join("; ")));
      }
      next(err);
    }
  };
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    try {
      req.query = schema.parse(req.query ?? {});
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new AppError(400, err.errors.map((e) => e.message).join("; ")));
      }
      next(err);
    }
  };
}

export function validateParams(schema) {
  return (req, _res, next) => {
    try {
      req.params = schema.parse(req.params ?? {});
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new AppError(400, err.errors.map((e) => e.message).join("; ")));
      }
      next(err);
    }
  };
}
