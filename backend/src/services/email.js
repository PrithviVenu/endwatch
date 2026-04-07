import { Resend } from "resend";
import { logger } from "../utils/logger.js";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ensureEmailReady() {
  if (!apiKey || !resend) {
    logger.info({ msg: "email_alerts_disabled" });
    return null;
  }
  const from = process.env.ALERT_FROM_EMAIL;
  if (!from) {
    logger.info({ msg: "email_alerts_disabled", reason: "ALERT_FROM_EMAIL not set" });
    return null;
  }
  return from;
}

/**
 * Sends a DOWN alert email. Never throws; failures are logged only.
 * Fire-and-forget: does not return a Promise; never await.
 */
export function sendDownAlert(userEmail, urlAddress, error) {
  try {
    const from = ensureEmailReady();
    if (!from) return;

    const timestamp = new Date().toISOString();
    const safeUrl = escapeHtml(urlAddress);
    const safeErr =
      error != null && error !== "" ? escapeHtml(error) : null;

    const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
    <h2 style="margin: 0 0 12px;">URL monitor alert</h2>
    <p style="margin: 0 0 8px;"><strong>URL</strong><br/>${safeUrl}</p>
    <p style="margin: 0 0 8px;"><strong>Status</strong><br/>DOWN</p>
    ${
      safeErr
        ? `<p style="margin: 0 0 8px;"><strong>Error</strong><br/>${safeErr}</p>`
        : ""
    }
    <p style="margin: 0 0 16px;"><strong>Timestamp</strong><br/>${escapeHtml(
      timestamp
    )}</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
    <p style="font-size: 12px; color: #6b7280;">
      You are receiving this because you monitor this URL on Endwatch
    </p>
  </body>
</html>
`.trim();

    void (async () => {
      try {
        await resend.emails.send({
          from,
          to: userEmail,
          subject: `🔴 [Endwatch] URL is DOWN: ${urlAddress}`,
          html,
        });
        logger.info({
          msg: "alert_email_sent",
          urlAddress,
          userEmail,
          kind: "down",
        });
      } catch (e) {
        logger.error({
          msg: "alert_email_failed",
          kind: "down",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
  } catch (e) {
    logger.error({
      msg: "alert_email_failed",
      kind: "down",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Sends a recovery (UP) alert email. Never throws; failures are logged only.
 * Fire-and-forget: does not return a Promise; never await.
 */
export function sendRecoveryAlert(userEmail, urlAddress) {
  try {
    const from = ensureEmailReady();
    if (!from) return;

    const timestamp = new Date().toISOString();
    const safeUrl = escapeHtml(urlAddress);

    const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
    <h2 style="margin: 0 0 12px;">URL recovered</h2>
    <p style="margin: 0 0 8px;"><strong>URL</strong><br/>${safeUrl}</p>
    <p style="margin: 0 0 8px;"><strong>Status</strong><br/>UP — endpoint is responding again</p>
    <p style="margin: 0 0 16px;"><strong>Timestamp</strong><br/>${escapeHtml(
      timestamp
    )}</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
    <p style="font-size: 12px; color: #6b7280;">
      You are receiving this because you monitor this URL on Endwatch
    </p>
  </body>
</html>
`.trim();

    void (async () => {
      try {
        await resend.emails.send({
          from,
          to: userEmail,
          subject: `🟢 [Endwatch] URL recovered: ${urlAddress}`,
          html,
        });
        logger.info({
          msg: "alert_email_sent",
          urlAddress,
          userEmail,
          kind: "recovery",
        });
      } catch (e) {
        logger.error({
          msg: "alert_email_failed",
          kind: "recovery",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
  } catch (e) {
    logger.error({
      msg: "alert_email_failed",
      kind: "recovery",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

const FRONTEND_URL =
  process.env.FRONTEND_URL?.replace(/\/$/, "") || "http://localhost:5173";

/**
 * Sends account verification email. No-op if RESEND_API_KEY is unset.
 * Fire-and-forget; never throws.
 */
export function sendVerificationEmail(userEmail, verifyToken) {
  try {
    if (!apiKey || !resend) {
      return;
    }
    const from = process.env.ALERT_FROM_EMAIL;
    if (!from) {
      return;
    }

    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(
      verifyToken
    )}`;
    const safeLink = escapeHtml(verifyUrl);

    const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #e5e7eb; background: #0f1419; margin: 0; padding: 24px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; margin: 0 auto;">
      <tr>
        <td style="background: #1a2332; border-radius: 12px; padding: 32px; border: 1px solid #2d3a4d;">
          <h1 style="margin: 0 0 8px; font-size: 22px; color: #f9fafb;">Verify your Endwatch account</h1>
          <p style="margin: 0 0 24px; color: #9ca3af; font-size: 15px;">
            Thanks for signing up. Click the button below to verify your email and start monitoring your URLs.
          </p>
          <a href="${verifyUrl}" style="display: inline-block; background: #3b82f6; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px; font-size: 15px;">
            Verify email
          </a>
          <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280;">
            Or copy this link into your browser:<br />
            <span style="word-break: break-all; color: #9ca3af;">${safeLink}</span>
          </p>
          <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">
            This link expires in 24 hours. If you did not create an account, you can ignore this email.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();

    void (async () => {
      try {
        await resend.emails.send({
          from,
          to: userEmail,
          subject: "Verify your Endwatch account",
          html,
        });
        logger.info({
          msg: "verification_email_sent",
          userEmail,
        });
      } catch (e) {
        logger.error({
          msg: "verification_email_failed",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
  } catch (e) {
    logger.error({
      msg: "verification_email_failed",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Sends password reset email. No-op if RESEND_API_KEY is unset.
 * Fire-and-forget; never throws.
 */
export function sendPasswordResetEmail(userEmail, resetToken) {
  try {
    if (!apiKey || !resend) {
      return;
    }
    const from = process.env.ALERT_FROM_EMAIL;
    if (!from) {
      return;
    }

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(
      resetToken
    )}`;
    const safeLink = escapeHtml(resetUrl);

    const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #e5e7eb; background: #0f1419; margin: 0; padding: 24px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; margin: 0 auto;">
      <tr>
        <td style="background: #1a2332; border-radius: 12px; padding: 32px; border: 1px solid #2d3a4d;">
          <h1 style="margin: 0 0 8px; font-size: 22px; color: #f9fafb;">Reset your Endwatch password</h1>
          <p style="margin: 0 0 24px; color: #9ca3af; font-size: 15px;">
            Click the button below to reset your password. This link expires in 1 hour.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #3b82f6; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px; font-size: 15px;">
            Reset password
          </a>
          <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280;">
            Or copy this link into your browser:<br />
            <span style="word-break: break-all; color: #9ca3af;">${safeLink}</span>
          </p>
          <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">
            If you did not request a password reset, you can ignore this email.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();

    void (async () => {
      try {
        await resend.emails.send({
          from,
          to: userEmail,
          subject: "Reset your Endwatch password",
          html,
        });
        logger.info({
          msg: "password_reset_email_sent",
          userEmail,
        });
      } catch (e) {
        logger.error({
          msg: "password_reset_email_failed",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
  } catch (e) {
    logger.error({
      msg: "password_reset_email_failed",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
