import "server-only";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

type NodemailerAddress = string | { name?: string; address: string };

export interface SmtpAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendMailInput {
  to: string[];
  cc?: string[];
  subject: string;
  htmlBody: string;
  attachments?: SmtpAttachment[];
  inReplyTo?: string;
  references?: string[];
}

export interface SendMailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

let cachedTransport: Transporter | null = null;

function getTransport(): Transporter {
  if (cachedTransport) return cachedTransport;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP_HOST, SMTP_USER, and SMTP_PASS must be set for MAIL_DRIVER=smtp.",
    );
  }

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    pool: true,
    maxConnections: 4,
    maxMessages: 100,
  });

  return cachedTransport;
}

export async function sendMailViaSmtp(
  input: SendMailInput,
): Promise<SendMailResult> {
  const transport = getTransport();

  const info = await transport.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: input.to.join(", "),
    cc: input.cc?.join(", "),
    subject: input.subject,
    html: input.htmlBody,
    inReplyTo: input.inReplyTo,
    references: input.references,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  const accepted: string[] = (info.accepted ?? []).map(
    (a: NodemailerAddress) => (typeof a === "string" ? a : a.address),
  );
  const rejected: string[] = (info.rejected ?? []).map(
    (a: NodemailerAddress) => (typeof a === "string" ? a : a.address),
  );

  return {
    messageId: info.messageId,
    accepted,
    rejected,
  };
}
