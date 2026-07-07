import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import { query } from "../db/index.js";
import { maskSecret } from "./s3.js";

export interface EmailConfig {
  host?: string;
  smtpHost?: string;
  port?: number;
  encryption?: "TLS" | "SSL" | "None" | string;
  username?: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
  enabled?: boolean;
}

function appBaseUrl() {
  return (process.env.APP_URL || process.env.PUBLIC_URL || "http://localhost:47821").replace(/\/$/, "");
}

export function sanitizeEmailForResponse(config: EmailConfig) {
  return {
    ...config,
    host: config.host ?? config.smtpHost ?? "",
    password: config.password ? maskSecret(config.password) : "",
    hasCredentials: Boolean(config.username && config.password),
  };
}

export async function loadEmailConfig(): Promise<EmailConfig> {
  const result = await query<{ value: unknown }>("SELECT value FROM system_settings WHERE key = 'email'");
  return (result.rows[0]?.value ?? {}) as EmailConfig;
}

function resolveHost(config: EmailConfig) {
  return (config.host || config.smtpHost || "").trim();
}

function transportOptions(config: EmailConfig): SMTPTransport.Options {
  const host = resolveHost(config);
  const port = Number(config.port ?? 587);
  const encryption = String(config.encryption ?? "TLS");
  const secure = encryption === "SSL";
  return {
    host,
    port,
    secure,
    auth: config.username ? { user: config.username, pass: config.password ?? "" } : undefined,
    requireTLS: encryption === "TLS",
    tls: encryption === "None" ? { rejectUnauthorized: false } : undefined,
  };
}

function isConfigured(config: EmailConfig) {
  return Boolean(resolveHost(config) && config.enabled !== false);
}

async function getTransporter(config?: EmailConfig) {
  const cfg = config ?? await loadEmailConfig();
  if (!isConfigured(cfg)) {
    throw new Error("SMTP is not configured. Set host, credentials, and enable email in Admin → System Settings.");
  }
  return nodemailer.createTransport(transportOptions(cfg));
}

async function sendMail(to: string, subject: string, text: string, html: string, config?: EmailConfig) {
  const cfg = config ?? await loadEmailConfig();
  const transporter = await getTransporter(cfg);
  const fromName = cfg.fromName || "MetaboAnalytics";
  const fromEmail = cfg.fromEmail || cfg.username || "noreply@metaboanalytics.local";
  await transporter.sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, text, html });
}

export async function sendPasswordResetEmail(email: string, token: string, config?: EmailConfig) {
  const link = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your MetaboAnalytics password";
  const text = `Use this link to reset your password (valid for 1 hour):\n\n${link}\n\nIf you did not request this, you can ignore this email.`;
  const html = `<p>Use this link to reset your password (valid for 1 hour):</p><p><a href="${link}">${link}</a></p><p>If you did not request this, you can ignore this email.</p>`;
  await sendMail(email, subject, text, html, config);
}

export async function sendUserWelcomeEmail(email: string, name: string, tempPassword: string, config?: EmailConfig) {
  const link = appBaseUrl();
  const subject = "Your MetaboAnalytics account";
  const text = `Hello ${name},\n\nAn administrator created an account for you.\n\nSign in: ${link}\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nPlease change your password after signing in.`;
  const html = `<p>Hello ${name},</p><p>An administrator created an account for you.</p><p><a href="${link}">Sign in to MetaboAnalytics</a></p><p><strong>Email:</strong> ${email}<br/><strong>Temporary password:</strong> ${tempPassword}</p><p>Please change your password after signing in.</p>`;
  await sendMail(email, subject, text, html, config);
}

export async function sendProjectInviteEmail(email: string, projectName: string, inviterName: string, config?: EmailConfig) {
  const link = appBaseUrl();
  const subject = `Invitation to collaborate on ${projectName}`;
  const text = `${inviterName} invited you to collaborate on "${projectName}" in MetaboAnalytics.\n\nOpen the app: ${link}\n\nSign in with this email address to access the project once your membership is active.`;
  const html = `<p><strong>${inviterName}</strong> invited you to collaborate on <strong>${projectName}</strong>.</p><p><a href="${link}">Open MetaboAnalytics</a></p>`;
  await sendMail(email, subject, text, html, config);
}

export async function verifySmtpConnection(config: EmailConfig, testRecipient?: string) {
  const transporter = nodemailer.createTransport(transportOptions(config));
  await transporter.verify();
  if (testRecipient) {
    await sendMail(
      testRecipient,
      "MetaboAnalytics SMTP test",
      "SMTP configuration is working.",
      "<p>SMTP configuration is working.</p>",
      config
    );
  }
  return { success: true, message: testRecipient ? `Test email sent to ${testRecipient}` : "SMTP connection verified" };
}

export async function trySendPasswordReset(email: string, token: string) {
  const config = await loadEmailConfig();
  if (!isConfigured(config)) {
    console.log(`[password-reset] SMTP not configured — token for ${email}: ${token}`);
    console.log(`[password-reset] Reset URL: ${appBaseUrl()}/reset-password?token=${token}`);
    return { sent: false, logged: true };
  }
  await sendPasswordResetEmail(email, token, config);
  return { sent: true, logged: false };
}
