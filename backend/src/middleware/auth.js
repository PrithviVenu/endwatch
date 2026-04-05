import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }

  const userId = decoded.sub;
  if (!userId || typeof userId !== "string") {
    return res.status(401).json({ error: "Invalid token payload" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };

  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}
