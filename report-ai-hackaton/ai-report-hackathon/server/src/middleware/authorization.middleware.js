export function requireRoles(...allowedRoles) {
  return function authorizeByRole(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
    }

    if (!req.user.organizationId) {
      return res.status(403).json({
        status: "error",
        message: "An active organization is required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to perform this action",
      });
    }

    next();
  };
}