import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function signAccessToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error("JWT_SECRET is not configured");
    err.status = 500;
    throw err;
  }
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: "15m" }
  );
}

function signRefreshToken(userId) {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    const err = new Error("JWT_REFRESH_SECRET is not configured");
    err.status = 500;
    throw err;
  }
  return jwt.sign({ sub: userId, typ: "refresh" }, secret, {
    expiresIn: "7d",
  });
}

function issueTokens(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user.id),
    user: sanitizeUser(user),
  };
}

router.post("/signup", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ error: "Valid email is required" });
  }
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required" });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
    });
    const tokens = issueTokens(user);
    return res.status(201).json(tokens);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "Email already registered" });
    }
    throw e;
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const tokens = issueTokens(user);
  return res.json(tokens);
});

router.post("/refresh", async (req, res) => {
  const refreshToken =
    req.body?.refreshToken ??
    (typeof req.body?.refresh_token === "string"
      ? req.body.refresh_token
      : null);

  if (!refreshToken || typeof refreshToken !== "string") {
    return res.status(400).json({ error: "refreshToken is required" });
  }

  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, secret);
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  if (decoded.typ !== "refresh") {
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  const userId = decoded.sub;
  if (!userId || typeof userId !== "string") {
    return res.status(401).json({ error: "Invalid token payload" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  const accessToken = signAccessToken(user);
  return res.json({ accessToken });
});

export default router;
