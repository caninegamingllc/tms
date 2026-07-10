import { createTransport } from "nodemailer";

type SendResult = {
  delivered: boolean;
};

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<SendResult> {
  if (!smtpConfigured()) {
    console.info(`[password-reset] ${to}: ${resetUrl}`);
    return { delivered: false };
  }

  const transport = createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        : undefined
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Reset your TMS password",
    text: `Use this link to reset your password. It expires in 1 hour.\n\n${resetUrl}`,
    html: `<p>Use this link to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
  });

  return { delivered: true };
}

export function isSmtpConfigured() {
  return smtpConfigured();
}
