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
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;max-width:560px">
      <p style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb">
        Broker OS
      </p>
      <h1 style="font-size:24px;margin:12px 0 8px">Reset your password</h1>
      <p>We received a request to reset your TMS password. Use the button below to choose a new one.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700">
          Reset Password
        </a>
      </p>
      <p style="font-size:14px;color:#64748b">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      <p style="font-size:12px;color:#94a3b8;word-break:break-all">${resetUrl}</p>
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

  if (resendConfigured()) {
    await sendViaResend(to, subject, html, text);
    return { delivered: true };
  }

  if (smtpConfigured()) {
    await sendViaSmtp(to, subject, html, text);
    return { delivered: true };
  }

  console.info(`[password-reset] ${to}: ${resetUrl}`);
  return { delivered: false };
}
