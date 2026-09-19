import prisma from "../config/prisma.js";
import { AppError } from "../lib/customError.js";
import { userHasStaffRole } from "../lib/staffRoles.js";

/**
 * Enforce completed 2FA verification for staff roles accessing protected
 * operations, admin, and sensitive financial/PII routes.
 *
 * Strictly according to SDS M00, Appendix E (NFR-SEC-03, AUTH-05, UF-00.8, UF-15.8).
 */
export async function requireStaff2fa(req, _res, next) {
  try {
    if (req.authMode === "internal") {
      return next();
    }

    if (!req.user?.id) {
      return next(new AppError(401, "Authentication required"));
    }

    // Check if the user holds any staff/operations role
    const userRoles = await prisma.userRole.findMany({
      where: { userId: req.user.id },
      include: { role: { select: { name: true } } },
    });

    const isStaff = userHasStaffRole(userRoles);
    if (!isStaff) {
      // Non-staff user (e.g. B2C traveller): pass through to downstream permission checks
      return next();
    }

    // Staff user: MUST have completed 2FA verification in this session
    if (!req.user.mfa) {
      const err = new AppError(
        403,
        "Two-factor authentication is required for staff roles accessing operations and financial records",
      );
      err.code = "MFA_REQUIRED";
      return next(err);
    }

    next();
  } catch (err) {
    next(err);
  }
}
