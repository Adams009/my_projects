import jwt from "jsonwebtoken";
import config from "#config/envConfig.js";
import User from "#models/userModel.js" 

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // if (!authHeader?.startsWith("Bearer ")) {
    //   return res.status(401).json({ error: "Unauthorized: No token provided" });
    // }
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    // req.user = { id: decoded.id, email: decoded.email, accountNumber: decoded.accountNumber };
    req.user = user

    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export default authMiddleware;
