import { successResponse } from "../../lib/response.js";
import { createSignedUploadUrl } from "./uploads.service.js";

export async function signUpload(req, res, next) {
  try {
    const data = await createSignedUploadUrl(req.body, { userId: req.user?.id });
    return successResponse(res, "Signed upload URL created", data);
  } catch (e) {
    next(e);
  }
}
