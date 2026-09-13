export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "BAD_REQUEST",
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }

  console.error(error);
  return Response.json({ error: "发生了意外错误，请稍后重试。" }, { status: 500 });
}
