import { ApiError } from "../../domain/models/api";

export function createDataResponse(data: unknown, status = 200): Response {
  return Response.json({ data }, { status });
}

export function createErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          counted: error.counted,
          ...(error.details ? { details: error.details } : {})
        }
      },
      {
        status: error.status
      }
    );
  }

  return Response.json(
    {
      error: {
        code: "system_error",
        message: "系统异常，请稍后重试。",
        counted: false
      }
    },
    {
      status: 500
    }
  );
}
