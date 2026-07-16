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

function normalizeEmailSubject(subject: string) {
  let value = subject.trim();
  // Strip repeated Re:/Fw:/Fwd: prefixes.
  for (let i = 0; i < 5; i += 1) {
    const next = value.replace(/^(re|fw|fwd)\s*:\s*/i, "").trim();
    if (next === value) break;
    value = next;
  }
  return value.toLowerCase();
}

function emailSubjectsMatch(a: string, b: string) {
  const left = normalizeEmailSubject(a);
  const right = normalizeEmailSubject(b);
  // Exact match only (after stripping Re:/Fw:). Substring matching lets short
  // load numbers like "9999" attach unrelated company mail to a thread.
  return Boolean(left && right && left === right);
}

function microsoftMessageInvolvesMailbox(
  message: {
    from?: { emailAddress?: { address?: string } };
    toRecipients?: Array<{ emailAddress?: { address?: string } }>;
  },
  mailboxEmail: string
) {
  const email = mailboxEmail.toLowerCase();
  const from = message.from?.emailAddress?.address?.toLowerCase() ?? "";
  if (from === email) return true;
  return (message.toRecipients ?? []).some(
    (recipient) => (recipient.emailAddress?.address ?? "").toLowerCase() === email
  );
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
      type MicrosoftMessage = {
        id: string;
        subject?: string;
        bodyPreview?: string;
        conversationId?: string;
        receivedDateTime?: string;
        sentDateTime?: string;
        from?: { emailAddress?: { address?: string } };
        toRecipients?: Array<{ emailAddress?: { address?: string } }>;
      };

      const seenMessageIds = new Set(
        thread.messages.map((item) => item.providerMessageId).filter(Boolean) as string[]
      );

      const conversationBelongsToThread = (messages: MicrosoftMessage[]) =>
        messages.some(
          (message) =>
            emailSubjectsMatch(message.subject ?? "", thread.subject) &&
            microsoftMessageInvolvesMailbox(message, mailbox.emailAddress)
        );

      // Collapse duplicate outbounds from earlier syncs (local sent-* row + Graph copy).
      const matchingOutbounds = thread.messages
        .filter(
          (message) =>
            message.direction === "OUTBOUND" && emailSubjectsMatch(message.subject, thread.subject)
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      if (matchingOutbounds.length > 1) {
        const keep =
          matchingOutbounds.find(
            (message) =>
              message.providerMessageId && !message.providerMessageId.startsWith("sent-")
          ) ?? matchingOutbounds[0];
        const dropIds = matchingOutbounds
          .filter((message) => message.id !== keep.id)
          .map((message) => message.id);
        if (dropIds.length > 0) {
          await prisma.emailMessage.deleteMany({ where: { id: { in: dropIds } } });
          thread.messages = thread.messages.filter((message) => !dropIds.includes(message.id));
        }
      }

      const importMicrosoftMessage = async (message: MicrosoftMessage) => {
        if (seenMessageIds.has(message.id)) {
          return;
        }

        // Never attach unrelated mail into an existing ops thread.
        if (!emailSubjectsMatch(message.subject ?? "", thread.subject)) {
          return;
        }
        if (!microsoftMessageInvolvesMailbox(message, mailbox.emailAddress)) {
          return;
        }

        const from = message.from?.emailAddress?.address ?? "";
        const to =
          message.toRecipients?.map((recipient) => recipient.emailAddress?.address ?? "").join(", ") ??
          "";
        const direction =
          from.toLowerCase() === mailbox.emailAddress.toLowerCase() ? "OUTBOUND" : "INBOUND";

        // Microsoft sendMail does not return ids, so the original outbound is stored as sent-*.
        // Reconcile that row instead of inserting a second outbound copy from Graph.
        if (direction === "OUTBOUND") {
          const existingOutbound = thread.messages.find(
            (item) =>
              item.direction === "OUTBOUND" &&
              emailSubjectsMatch(item.subject, message.subject ?? thread.subject)
          );
          if (existingOutbound) {
            if (existingOutbound.providerMessageId !== message.id) {
              await prisma.emailMessage.update({
                where: { id: existingOutbound.id },
                data: {
                  providerMessageId: message.id,
                  bodyPreview: message.bodyPreview ?? existingOutbound.bodyPreview,
                  sentAt: message.sentDateTime
                    ? new Date(message.sentDateTime)
                    : existingOutbound.sentAt,
                  toAddresses: to || existingOutbound.toAddresses
                }
              });
              existingOutbound.providerMessageId = message.id;
            }
            seenMessageIds.add(message.id);
            return;
          }
        }

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
        seenMessageIds.add(message.id);

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
      };

      const importConversation = async (conversationId: string) => {
        const remote = await listMicrosoftConversationMessages(accessToken, conversationId);
        if (!conversationBelongsToThread(remote.value)) {
          return false;
        }
        for (const message of remote.value) {
          await importMicrosoftMessage(message);
        }
        return true;
      };

      // Drop previously mis-linked inbound rows (e.g. load-number search false positives).
      const staleInbound = thread.messages.filter(
        (message) =>
          message.direction === "INBOUND" && !emailSubjectsMatch(message.subject, thread.subject)
      );
      if (staleInbound.length > 0) {
        await prisma.emailMessage.deleteMany({
          where: { id: { in: staleInbound.map((message) => message.id) } }
        });
      }

      let conversationId = thread.providerThreadId;
      let syncedFromConversation = false;

      if (conversationId) {
        try {
          syncedFromConversation = await importConversation(conversationId);
          if (!syncedFromConversation) {
            // Stored conversationId was from unrelated mail — clear and rediscover.
            await prisma.emailThread.update({
              where: { id: thread.id },
              data: { providerThreadId: null }
            });
            conversationId = null;
          }
        } catch {
          syncedFromConversation = false;
        }
      }

      if (!syncedFromConversation) {
        // Discover OUR outbound in Outlook by thread subject, never by bare load number
        // (short numbers like "9999" match unrelated company mail).
        const remote = await searchMicrosoftMessages(accessToken, thread.subject);
        const outboundMatch = remote.value.find((message) => {
          const from = (message.from?.emailAddress?.address ?? "").toLowerCase();
          return (
            from === mailbox.emailAddress.toLowerCase() &&
            emailSubjectsMatch(message.subject ?? "", thread.subject) &&
            Boolean(message.conversationId)
          );
        });

        if (outboundMatch?.conversationId) {
          conversationId = outboundMatch.conversationId;
          await prisma.emailThread.update({
            where: { id: thread.id },
            data: { providerThreadId: conversationId }
          });
          try {
            await importConversation(conversationId);
          } catch {
            // Subject-matched search hits below as a last resort for this outbound only.
          }
        }

        // Last resort: only import subject-matched messages that involve this mailbox.
        // Do not adopt conversationId from random load-number hits.
        for (const message of remote.value) {
          await importMicrosoftMessage(message);
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
