import { z } from "zod";

const objectKeyPattern = /^(?!\/)(?!.*\.\.)[a-zA-Z0-9/_\-.]+$/;

export const signUploadBodySchema = z.object({
  objectKey: z
    .string()
    .min(3)
    .max(1024)
    .regex(objectKeyPattern, "objectKey contains invalid characters"),
  contentType: z.string().trim().min(1).max(200),
});
