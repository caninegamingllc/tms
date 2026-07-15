import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import {
  completeGoogleMailOAuth,
  listGmailThreadMessages,
  refreshGoogleAccessToken,
  searchGmailMessages,
  getGmailMessage,
  sendGmailMessage
} from "@/lib/oauth/google";
import {
  completeMicrosoftMailOAuth,
  listMicrosoftConversationMessages,
  refreshMicrosoftAccessToken,
  searchMicrosoftMessages,
  sendMicrosoftMail
} from "@/lib/oauth/microsoft";
import type { OAuthProvider } from "@/lib/oauth/types";

function headerValue(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string
) {
  return headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function getUserMailbox(userId: string, provider?: OAuthProvider) {
  if (provider) {
    return prisma.userMailbox.findUnique({
      where: { userId_provider: { userId, provider } }
    });
  }

  return prisma.userMailbox.findFirst({
    where: { userId, status: "CONNECTED" },
    orderBy: { updatedAt: "desc" }
  });
}

export async function listUserMailboxes(userId: string) {
  return prisma.userMailbox.findMany({
    where: { userId },
    orderBy: { provider: "asc" }
  });
}

export async function storeUserMailbox(input: {
  userId: string;
  provider: OAuthProvider;
  emailAddress: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scopes?: string;
}) {
  const accessTokenEnc = encryptSecret(input.accessToken);
  const refreshTokenEnc = input.refreshToken ? encryptSecret(input.refreshToken) : null;
  const tokenExpiresAt = new Date(Date.now() + input.expiresIn * 1000);

  return prisma.userMailbox.upsert({
    where: {
      userId_provider: {
        userId: input.userId,
        provider: input.provider
      }
    },
    create: {
      userId: input.userId,
      provider: input.provider,
      emailAddress: input.emailAddress,
      accessTokenEnc,
      refreshTokenEnc,
      tokenExpiresAt,
      scopes: input.scopes,
      status: "CONNECTED",
      lastError: null
    },
    update: {
      emailAddress: input.emailAddress,
      accessTokenEnc,
      refreshTokenEnc: refreshTokenEnc ?? undefined,
      tokenExpiresAt,
      scopes: input.scopes,
      status: "CONNECTED",
      lastError: null
    }
  });
}

export async function disconnectUserMailbox(userId: string, provider: OAuthProvider) {
  await prisma.userMailbox.deleteMany({
    where: { userId, provider }
  });
}

export async function completeMailboxOAuth(
  provider: OAuthProvider,
  code: string,
  userId: string,
  requestOrigin?: string | null
) {
  const result =
    provider === "GOOGLE"
      ? await completeGoogleMailOAuth(code, requestOrigin)
      : await completeMicrosoftMailOAuth(code, requestOrigin);

  if (!result.tokens.refresh_token) {
    const existing = await getUserMailbox(userId, provider);
    if (!existing?.refreshTokenEnc) {
      throw new Error(
        "Mailbox connect did not return a refresh token. Disconnect previous app access and try again."
      );
    }
  }

  await storeUserMailbox({
    userId,
    provider,
    emailAddress: result.profile.email,
    accessToken: result.tokens.access_token,
    refreshToken: result.tokens.refresh_token,
    expiresIn: result.tokens.expires_in,
    scopes: result.tokens.scope
  });

  return result.profile.email;
}

async function getValidAccessToken(mailbox: {
  id: string;
  provider: string;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
}) {
  if (!mailbox.accessTokenEnc) {
    throw new Error("Mailbox is missing an access token. Reconnect your email.");
  }

  const expiresSoon =
    !mailbox.tokenExpiresAt || mailbox.tokenExpiresAt.getTime() < Date.now() + 60_000;

  if (!expiresSoon) {
    return decryptSecret(mailbox.accessTokenEnc);
  }

  if (!mailbox.refreshTokenEnc) {
    throw new Error("Mailbox session expired. Reconnect your email.");
  }

  const refreshToken = decryptSecret(mailbox.refreshTokenEnc);
  const refreshed =
    mailbox.provider === "GOOGLE"
      ? await refreshGoogleAccessToken(refreshToken)
      : await refreshMicrosoftAccessToken(refreshToken);

  await prisma.userMailbox.update({
    where: { id: mailbox.id },
    data: {
      accessTokenEnc: encryptSecret(refreshed.access_token),
      refreshTokenEnc: refreshed.refresh_token
        ? encryptSecret(refreshed.refresh_token)
        : undefined,
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      scopes: refreshed.scope,
      status: "CONNECTED",
      lastError: null
    }
  });

  return refreshed.access_token;
}

export type MailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

function buildRawMime(input: {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}) {
  const toHeader = input.to.join(", ");
  const hasAttachments = Boolean(input.attachments?.length);
  const altBoundary = `tms_alt_${Date.now()}`;
  const mixedBoundary = `tms_mixed_${Date.now()}`;

  const headers = [
    `From: ${input.from}`,
    `To: ${toHeader}`,
    `Subject: ${encodeSubject(input.subject)}`,
    "MIME-Version: 1.0"
  ];

  const alternativeParts = [
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    input.text,
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    input.html ?? `<pre>${input.text}</pre>`,
    `--${altBoundary}--`
  ];

  if (!hasAttachments) {
    if (input.html) {
      return Buffer.from(
        [...headers, `Content-Type: multipart/alternative; boundary="${altBoundary}"`, "", ...alternativeParts].join(
          "\r\n"
        )
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    }

    return Buffer.from(
      [...headers, 'Content-Type: text/plain; charset="UTF-8"', "", input.text].join("\r\n")
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  const attachmentParts = (input.attachments ?? []).flatMap((attachment) => {
    const encoded = attachment.content.toString("base64").replace(/(.{76})/g, "$1\r\n");
    return [
      `--${mixedBoundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      encoded
    ];
  });

  return Buffer.from(
    [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      "",
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      "",
      ...alternativeParts,
      ...attachmentParts,
      `--${mixedBoundary}--`
    ].join("\r\n")
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeSubject(subject: string) {
  if (/^[\x20-\x7E]*$/.test(subject)) {
    return subject;
  }
  return `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
}

export type SendMailboxResult = {
  provider: OAuthProvider;
  fromAddress: string;
  providerMessageId?: string;
  providerThreadId?: string;
};

export async function sendViaUserMailbox(input: {
  userId: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}): Promise<SendMailboxResult> {
  const mailbox = await getUserMailbox(input.userId);
  if (!mailbox || mailbox.status !== "CONNECTED") {
    throw new Error("Connect your Gmail or Microsoft mailbox in Settings > Email before sending.");
  }

  const accessToken = await getValidAccessToken(mailbox);
  const provider = mailbox.provider as OAuthProvider;

  if (provider === "GOOGLE") {
    const raw = buildRawMime({
      from: mailbox.emailAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments
    });
    const sent = await sendGmailMessage(accessToken, raw);
    return {
      provider,
      fromAddress: mailbox.emailAddress,
      providerMessageId: sent.id,
      providerThreadId: sent.threadId
    };
  }

  await sendMicrosoftMail(accessToken, {
    subject: input.subject,
    to: input.to,
    bodyText: input.text,
    bodyHtml: input.html,
    attachments: input.attachments?.map((attachment) => ({
      name: attachment.filename,
      contentType: attachment.contentType,
      contentBytes: attachment.content.toString("base64")
    }))
  });

  // Graph sendMail does not return ids; a sentinel is stored and reconciled on sync.
  return {
    provider,
    fromAddress: mailbox.emailAddress,
    providerMessageId: `sent-${Date.now()}`,
    providerThreadId: undefined
  };
}

export async function syncMailboxThreadsForUser(userId: string, companyId: string) {
  const mailbox = await getUserMailbox(userId);
  if (!mailbox || mailbox.status !== "CONNECTED") {
    return { synced: 0 };
  }

  const accessToken = await getValidAccessToken(mailbox);
  const threads = await prisma.emailThread.findMany({
    where: { userId, companyId },
    include: { messages: true, load: { select: { loadNumber: true } } }
  });

  let synced = 0;

  for (const thread of threads) {
    if (mailbox.provider === "GOOGLE" && thread.providerThreadId) {
      const remote = await listGmailThreadMessages(accessToken, thread.providerThreadId);
      for (const message of remote.messages ?? []) {
        const exists = thread.messages.some((item) => item.providerMessageId === message.id);
        if (exists) {
          continue;
        }

        const from = headerValue(message.payload?.headers, "From");
        const to = headerValue(message.payload?.headers, "To");
        const subject = headerValue(message.payload?.headers, "Subject") || thread.subject;
        const direction =
          from.toLowerCase().includes(mailbox.emailAddress.toLowerCase()) ? "OUTBOUND" : "INBOUND";

        await prisma.emailMessage.create({
          data: {
            threadId: thread.id,
            userId,
            direction,
            fromAddress: from,
            toAddresses: to,
            subject,
            bodyPreview: message.snippet ?? null,
            providerMessageId: message.id,
            sentAt: direction === "OUTBOUND" ? new Date(Number(message.internalDate ?? Date.now())) : null,
            receivedAt:
              direction === "INBOUND" ? new Date(Number(message.internalDate ?? Date.now())) : null
          }
        });

        if (direction === "INBOUND") {
          await prisma.loadActivity.create({
            data: {
              loadId: thread.loadId,
              userId,
              action: "Email reply received",
              details: subject
            }
          });
        }

        synced += 1;
      }
    }

    if (mailbox.provider === "MICROSOFT") {
      if (thread.providerThreadId) {
        const remote = await listMicrosoftConversationMessages(accessToken, thread.providerThreadId);
        for (const message of remote.value) {
          const exists = thread.messages.some((item) => item.providerMessageId === message.id);
          if (exists) {
            continue;
          }

          const from = message.from?.emailAddress?.address ?? "";
          const to =
            message.toRecipients?.map((recipient) => recipient.emailAddress?.address ?? "").join(", ") ??
            "";
          const direction =
            from.toLowerCase() === mailbox.emailAddress.toLowerCase() ? "OUTBOUND" : "INBOUND";

          await prisma.emailMessage.create({
            data: {
              threadId: thread.id,
              userId,
              direction,
              fromAddress: from,
              toAddresses: to,
              subject: message.subject ?? thread.subject,
              bodyPreview: message.bodyPreview ?? null,
              providerMessageId: message.id,
              sentAt: message.sentDateTime ? new Date(message.sentDateTime) : null,
              receivedAt: message.receivedDateTime ? new Date(message.receivedDateTime) : null
            }
          });

          if (direction === "INBOUND") {
            await prisma.loadActivity.create({
              data: {
                loadId: thread.loadId,
                userId,
                action: "Email reply received",
                details: message.subject ?? thread.subject
              }
            });
          }

          synced += 1;
        }
      } else if (thread.load.loadNumber) {
        const remote = await searchMicrosoftMessages(accessToken, thread.load.loadNumber);
        for (const message of remote.value) {
          if (message.conversationId && !thread.providerThreadId) {
            await prisma.emailThread.update({
              where: { id: thread.id },
              data: { providerThreadId: message.conversationId }
            });
          }
        }
      }
    }
  }

  // Also pick up inbound mail that references known load numbers.
  const companyLoads = await prisma.load.findMany({
    where: { companyId },
    select: { id: true, loadNumber: true },
    take: 100,
    orderBy: { updatedAt: "desc" }
  });

  if (mailbox.provider === "GOOGLE") {
    for (const load of companyLoads) {
      const found = await searchGmailMessages(accessToken, `"${load.loadNumber}" newer_than:14d`);
      for (const hit of found.messages ?? []) {
        const existingThread = await prisma.emailThread.findFirst({
          where: {
            loadId: load.id,
            OR: [{ providerThreadId: hit.threadId }, { messages: { some: { providerMessageId: hit.id } } }]
          }
        });

        if (existingThread) {
          continue;
        }

        const full = await getGmailMessage(accessToken, hit.id);
        const from = headerValue(full.payload?.headers, "From");
        if (from.toLowerCase().includes(mailbox.emailAddress.toLowerCase())) {
          continue;
        }

        const subject = headerValue(full.payload?.headers, "Subject") || `Re: ${load.loadNumber}`;
        const to = headerValue(full.payload?.headers, "To");

        const created = await prisma.emailThread.create({
          data: {
            companyId,
            loadId: load.id,
            userId,
            purpose: "GENERAL",
            subject,
            provider: "GOOGLE",
            providerThreadId: full.threadId,
            messages: {
              create: {
                userId,
                direction: "INBOUND",
                fromAddress: from,
                toAddresses: to,
                subject,
                bodyPreview: full.snippet ?? null,
                providerMessageId: full.id,
                receivedAt: new Date(Number(full.internalDate ?? Date.now()))
              }
            }
          }
        });

        await prisma.loadActivity.create({
          data: {
            loadId: load.id,
            userId,
            action: "Inbound email linked",
            details: subject
          }
        });

        void created;
        synced += 1;
      }
    }
  }

  await prisma.userMailbox.update({
    where: { id: mailbox.id },
    data: { lastSyncAt: new Date(), lastError: null }
  });

  return { synced };
}
