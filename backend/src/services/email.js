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
