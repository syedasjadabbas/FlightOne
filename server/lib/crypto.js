import crypto from "crypto";

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
