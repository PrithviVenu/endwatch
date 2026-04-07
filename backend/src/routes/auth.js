import crypto from "crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/email.js";

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const VERIFY_EMAIL_MESSAGE = "Please verify your email before continuing";
const INVALID_RESET_TOKEN_MESSAGE = "Invalid or expired reset token";

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
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

router.get("/verify-email", async (req, res) => {
  const token =
    typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!token) {
    return res.status(400).json({ error: "Verification token is required" });
  }

  const now = new Date();
  const user = await prisma.user.findFirst({
    where: {
      verifyToken: token,
      verifyTokenExpiry: { gt: now },
    },
  });

  if (!user) {
    return res.status(400).json({
      error: "Invalid or expired verification link",
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verifyToken: null,
      verifyTokenExpiry: null,
    },
  });

  return res.json({ success: true });
});

router.post("/resend-verification", async (req, res) => {
  const email = req.body?.email;
  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (user && !user.emailVerified) {
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken, verifyTokenExpiry },
    });
    sendVerificationEmail(normalizedEmail, verifyToken);
  }

  return res.json({
    success: true,
    message: "If this email is registered and not verified, a new link was sent.",
  });
});

router.post("/forgot-password", async (req, res) => {
  const email = req.body?.email;
  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    return res.status(200).json({
      success: true,
      message: "If that email exists, a reset link has been sent",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (user) {
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });
    sendPasswordResetEmail(normalizedEmail, resetToken);
  }

  return res.status(200).json({
    success: true,
    message: "If that email exists, a reset link has been sent",
  });
});

router.post("/reset-password", async (req, res) => {
  const token = req.body?.token;
  const password = req.body?.password;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: INVALID_RESET_TOKEN_MESSAGE });
  }
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required" });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  const now = new Date();
  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gt: now },
    },
  });

  if (!user) {
    return res.status(400).json({ error: INVALID_RESET_TOKEN_MESSAGE });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  return res.json({ success: true });
});

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
  const verifyToken = crypto.randomBytes(32).toString("hex");
  const verifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        emailVerified: false,
        verifyToken,
        verifyTokenExpiry,
      },
    });
    sendVerificationEmail(normalizedEmail, verifyToken);
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

  if (!user.emailVerified) {
    return res.status(403).json({ error: VERIFY_EMAIL_MESSAGE });
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

  if (!user.emailVerified) {
    return res.status(403).json({ error: VERIFY_EMAIL_MESSAGE });
  }

  const accessToken = signAccessToken(user);
  return res.json({ accessToken });
});

export default router;
