import jwt from "jsonwebtoken";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new Error("JWT_SECRET is not set");
  }
  return s;
}

export function signAccessToken(payload, expiresIn) {
  // Short-lived access JWT; HttpOnly refresh cookie + AuthBootstrap/RTK 401 refresh
  // re-issue. Override with JWT_ACCESS_EXPIRES_IN when needed (tests / rare ops).
  const exp = expiresIn ?? process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
  return jwt.sign(payload, secret(), { expiresIn: exp });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, secret());
}

export function signTempToken(payload, expiresIn = "5m") {
  return jwt.sign(payload, secret(), { expiresIn });
}

export function verifyTempToken(token, expectedPurpose) {
  const payload = jwt.verify(token, secret());
  if (expectedPurpose && payload.purpose !== expectedPurpose) {
    throw new Error("Invalid token purpose");
  }
  return payload;
}

