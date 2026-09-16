export const successResponse = (
  res,
  message = "Success",
  data = {},
  statusCode = 200,
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res,
  message = "Something went wrong",
  error = null,
  statusCode = 500,
) => {
  const payload = { success: false, message };
  if (error != null && typeof error === "object" && !(error instanceof Error)) {
    Object.assign(payload, error);
  } else if (error instanceof Error) {
    payload.error = error.message;
  } else if (error != null) {
    payload.error = String(error);
  }
  return res.status(statusCode).json(payload);
};
