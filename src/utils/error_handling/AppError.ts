import type { Context } from "hono";
<<<<<<< HEAD
import type { StatusCode } from "hono/utils/http-status";
import { ErrorResponse } from "utils/responses";

export default class AppError extends Error {
  private status: StatusCode;
=======
import { ErrorResponse } from "@/utils/responses";
import { StatusCodes } from "http-status-codes";
import type { ContentfulStatusCode } from "hono/utils/http-status";

type StatusCodeType = ContentfulStatusCode | undefined;
export default class AppError extends Error {
  private status: StatusCodeType;
>>>>>>> main
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
<<<<<<< HEAD
    status: StatusCode;
    isOperational: boolean;
=======
    status?: StatusCodeType;
    isOperational?: boolean;
>>>>>>> main
    details?: unknown;
    cause?: Error;
  }) {
    super(message, {
      cause,
    });
<<<<<<< HEAD
    this.status = status;
    this.isOperational = isOperational;
=======
    this.status = status ?? StatusCodes.INTERNAL_SERVER_ERROR;
    this.isOperational = isOperational ?? false;
>>>>>>> main
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
