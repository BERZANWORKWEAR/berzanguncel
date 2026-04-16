import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";

function envBool(value, fallback = false) {
  if (typeof value === "undefined" || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on", "evet"].includes(String(value).trim().toLowerCase());
}

function compactText(value, maxLength = 220) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function getMailboxConfig() {
  const address = String(process.env.MAILBOX_ADDRESS || process.env.IMAP_USER || process.env.SMTP_USER || "").trim();
  const password = String(process.env.MAILBOX_PASSWORD || process.env.IMAP_PASS || process.env.SMTP_PASS || "").trim();

  return {
    address,
    password,
    imap: {
      host: String(process.env.IMAP_HOST || "").trim(),
      port: Number(process.env.IMAP_PORT || 993),
      secure: envBool(process.env.IMAP_SECURE, true),
    },
    smtp: {
      host: String(process.env.SMTP_HOST || "").trim(),
      port: Number(process.env.SMTP_PORT || 465),
      secure: envBool(process.env.SMTP_SECURE, true),
      user: String(process.env.SMTP_USER || address).trim(),
      pass: String(process.env.SMTP_PASS || password).trim(),
      from: String(process.env.MAIL_FROM || address).trim(),
    },
  };
}

export function isMailboxConfigured() {
  const config = getMailboxConfig();
  return Boolean(
    config.address &&
      config.password &&
      config.imap.host &&
      config.imap.port &&
      config.smtp.host &&
      config.smtp.port &&
      config.smtp.user &&
      config.smtp.pass
  );
}

function requireConfigured() {
  if (!isMailboxConfigured()) {
    throw new Error("Kurumsal mail entegrasyonu için MAILBOX_ADDRESS, MAILBOX_PASSWORD, IMAP_HOST ve SMTP ayarları tanımlanmalı.");
  }
}

function createImapClient() {
  const config = getMailboxConfig();
  return new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: {
      user: config.address,
      pass: config.password,
    },
    logger: false,
  });
}

function createSmtpTransport() {
  const config = getMailboxConfig();
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
}

export async function getMailboxStatus() {
  const config = getMailboxConfig();
  if (!isMailboxConfigured()) {
    return {
      configured: false,
      connected: false,
      provider: "",
      accountEmail: config.address || "",
      displayName: config.address || "Kurumsal Mail",
      lastSyncAt: "",
      mode: "imap",
    };
  }

  const client = createImapClient();
  try {
    await client.connect();
    const status = await client.status("INBOX", { messages: true, unseen: true });
    return {
      configured: true,
      connected: true,
      provider: config.imap.host,
      accountEmail: config.address,
      displayName: config.address,
      lastSyncAt: new Date().toISOString(),
      mode: "imap",
      inboxCount: Number(status.messages || 0),
      unseenCount: Number(status.unseen || 0),
    };
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function listMailboxMessages({ top = 8 } = {}) {
  requireConfigured();
  const limit = Math.min(Math.max(Number(top || 8), 1), 20);
  const client = createImapClient();

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const total = Number(client.mailbox?.exists || 0);
      if (!total) return [];

      const start = Math.max(total - limit + 1, 1);
      const range = `${start}:${total}`;
      const messages = [];

      for await (const message of client.fetch(range, {
        uid: true,
        envelope: true,
        internalDate: true,
        flags: true,
        source: true,
      })) {
        let parsedText = "";
        try {
          const parsed = await simpleParser(message.source);
          parsedText = compactText(parsed.text || parsed.html || "", 220);
        } catch {}

        const sender =
          message.envelope?.from?.[0] || {};

        messages.push({
          id: String(message.uid || ""),
          subject: message.envelope?.subject || "(Konu yok)",
          from: {
            emailAddress: {
              name: sender.name || sender.address || "Bilinmeyen gönderici",
              address: sender.address || "",
            },
          },
          receivedDateTime: new Date(message.internalDate || message.envelope?.date || Date.now()).toISOString(),
          bodyPreview: parsedText || "Önizleme alınamadı.",
          isRead: message.flags?.has?.("\\Seen") || false,
        });
      }

      return messages.sort(
        (a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime()
      );
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function sendMailboxMail(payload = {}) {
  requireConfigured();
  const config = getMailboxConfig();
  const to = String(payload.to || "").trim();
  const subject = String(payload.subject || "").trim();
  const content = String(payload.content || "").trim();

  if (!to || !subject || !content) {
    throw new Error("Alıcı, konu ve içerik zorunludur.");
  }

  const transporter = createSmtpTransport();
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text: content,
  });

  return { ok: true };
}
