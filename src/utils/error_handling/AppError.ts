import type { Context } from "hono";
import type { StatusCode } from "hono/utils/http-status";
import { ErrorResponse } from "@/utils/responses";

export default class AppError extends Error {
  private status: StatusCode;
  private isOperational: boolean;
  private details?: unknown;

  constructor({
    message,
    status,
    isOperational,
    details,
    cause,
  }: {
    message: string;
    status: StatusCode;
    isOperational: boolean;
    details?: unknown;
    cause?: Error;
  }) {
    super(message, {
      cause,
    });
    this.status = status;
    this.isOperational = isOperational;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  handleInRoute(c: Context) {
    if (!this.isOperational) {
      console.error("Non-operational error:");
      console.error(`Name: ${this.name}`);
      console.error(`Message: ${this.message}`);
      console.error(`Stack: ${this.stack}`);
      if (this.cause) {
        console.error(`Underlying Error: ${this.cause}`);
      }
    }

    return c.json(
      ErrorResponse(
        this.isOperational ? this.message : "Internal Server Error",
      ),
      this.status,
    );
  }
}
