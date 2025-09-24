class ApiError extends Error {
  constructor(
    statusCode=500,
    message = "Some thing went wrong",
    stack = "",
    error = []
  ) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
    this.stack = stack;
    this.error = error;
    this.data = null;
    this.success = false;
  }
}

export default ApiError;
