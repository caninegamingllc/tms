import { createTransport } from "nodemailer";

type SendResult = {
  delivered: boolean;
};

function fromAddress() {
  return process.env.RESEND_FROM?.trim() || process.env.SMTP_FROM?.trim();
}

function resendApiKey() {
  const explicit = process.env.RESEND_API_KEY?.trim();
  if (explicit) {
    return explicit;
  }

  const host = process.env.SMTP_HOST?.trim().toLowerCase() ?? "";
  if (host.includes("resend.com")) {
    return process.env.SMTP_PASS?.trim();
  }

  return undefined;
}

function resendConfigured() {
  return Boolean(resendApiKey() && fromAddress());
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST?.trim() && fromAddress() && process.env.SMTP_PASS?.trim());
}

export function isEmailConfigured() {
  return resendConfigured() || smtpConfigured();
}

async function deliverEmail(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  if (resendConfigured()) {
    await sendViaResend(to, subject, html, text);
    return { delivered: true };
  }

  if (smtpConfigured()) {
    await sendViaSmtp(to, subject, html, text);
    return { delivered: true };
  }

  return { delivered: false };
}

function passwordResetContent(resetUrl: string) {
  const subject = "Reset your TMS password";
  const text = [
    "We received a request to reset your TMS password.",
    "Use the link below to choose a new password. It expires in 1 hour.",
    "",
    resetUrl,
    "",
    "If you did not request this, you can ignore this email."
  ].join("\n");

  const html = `
    <div style="font-family:'Source Sans 3',Arial,sans-serif;line-height:1.5;color:#1b2433;max-width:560px">
      <div style="height:3px;background:linear-gradient(90deg,#1e3a5f,#2b6b80,#3d9ba8);border-radius:2px;margin-bottom:18px"></div>
      <p style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#2b6b80;margin:0">
        Simple Source TMS
      </p>
      <h1 style="font-family:Georgia,serif;font-size:26px;margin:10px 0 8px;letter-spacing:-0.02em">Reset your password</h1>
      <p>We received a request to reset your TMS password. Use the button below to choose a new one.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="display:inline-block;background:#2b6b80;color:#fff;text-decoration:none;padding:11px 18px;border-radius:6px;font-weight:700">
          Reset Password
        </a>
      </p>
      <p style="font-size:14px;color:#64748b">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      <p style="font-size:12px;color:#94a3b8;word-break:break-all">${resetUrl}</p>
    </div>
  `.trim();

  return { subject, text, html };
}

type InviteEmailOptions = {
  inviteUrl: string;
  companyName: string;
  inviterName: string;
  inviteeName: string;
  role: string;
  expiresInDays: number;
};

function inviteContent(options: InviteEmailOptions) {
  const { inviteUrl, companyName, inviterName, inviteeName, role, expiresInDays } = options;
  const roleLabel = role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const subject = `You're invited to join ${companyName} on TMS`;
  const text = [
    `Hi ${inviteeName},`,
    "",
    `${inviterName} invited you to join ${companyName} on Simple Source TMS as a ${roleLabel}.`,
    "Use the link below to set your password and activate your account.",
    `This invite expires in ${expiresInDays} days.`,
    "",
    inviteUrl,
    "",
    "If you were not expecting this invite, you can ignore this email."
  ].join("\n");

  const html = `
    <div style="font-family:'Source Sans 3',Arial,sans-serif;line-height:1.5;color:#1b2433;max-width:560px">
      <div style="height:3px;background:linear-gradient(90deg,#1e3a5f,#2b6b80,#3d9ba8);border-radius:2px;margin-bottom:18px"></div>
      <p style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#2b6b80;margin:0">
        Simple Source TMS
      </p>
      <h1 style="font-family:Georgia,serif;font-size:26px;margin:10px 0 8px;letter-spacing:-0.02em">You're invited</h1>
      <p>Hi ${inviteeName},</p>
      <p><strong>${inviterName}</strong> invited you to join <strong>${companyName}</strong> as a <strong>${roleLabel}</strong>.</p>
      <p>Use the button below to set your password and activate your account.</p>
      <p style="margin:24px 0">
        <a href="${inviteUrl}" style="display:inline-block;background:#2b6b80;color:#fff;text-decoration:none;padding:11px 18px;border-radius:6px;font-weight:700">
          Accept Invite
        </a>
      </p>
      <p style="font-size:14px;color:#64748b">This invite expires in ${expiresInDays} days. If you were not expecting this invite, you can ignore this email.</p>
      <p style="font-size:12px;color:#94a3b8;word-break:break-all">${inviteUrl}</p>
    </div>
  `.trim();

  return { subject, text, html };
}

async function sendViaResend(to: string, subject: string, html: string, text: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject,
      html,
      text
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}

async function sendViaSmtp(to: string, subject: string, html: string, text: string) {
  const transport = createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER ?? "resend",
      pass: process.env.SMTP_PASS
    }
  });

  await transport.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<SendResult> {
  const { subject, text, html } = passwordResetContent(resetUrl);
  const result = await deliverEmail(to, subject, html, text);

  if (!result.delivered) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[password-reset] ${to}: ${resetUrl}`);
    } else {
      console.info(`[password-reset] email undelivered for ${to}`);
    }
  }

  return result;
}

export async function sendInviteEmail(to: string, options: InviteEmailOptions): Promise<SendResult> {
  const { subject, text, html } = inviteContent(options);
  const result = await deliverEmail(to, subject, html, text);

  if (!result.delivered) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[invite] ${to}: ${options.inviteUrl}`);
    } else {
      console.info(`[invite] email undelivered for ${to}`);
    }
  }

  return result;
}
