import "server-only";
import { getGraphAccessToken } from "./token";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export interface GraphAttachment {
  name: string;
  contentType: string;
  /** Base64-encoded file bytes. */
  contentBytes: string;
}

export interface SendMailInput {
  fromMailbox: string;
  to: string[];
  cc?: string[];
  subject: string;
  htmlBody: string;
  attachments?: GraphAttachment[];
}

export interface SendMailResult {
  messageId: string;
  conversationId: string | null;
  internetMessageId: string | null;
}

async function graphFetch(path: string, init: RequestInit): Promise<Response> {
  const token = await getGraphAccessToken();
  return fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

/**
 * Always uses the 3-step draft -> attach -> send Graph pattern, even for
 * small messages, rather than the single-call `sendMail` action — that
 * action has a ~4MB request-size ceiling that scanned invoice attachments
 * can realistically hit, so one uniform code path avoids branching on
 * attachment size.
 */
export async function sendMailViaGraph(
  input: SendMailInput,
): Promise<SendMailResult> {
  const mailbox = encodeURIComponent(input.fromMailbox);

  const draftResponse = await graphFetch(`/users/${mailbox}/messages`, {
    method: "POST",
    body: JSON.stringify({
      subject: input.subject,
      body: { contentType: "HTML", content: input.htmlBody },
      toRecipients: input.to.map((address) => ({ emailAddress: { address } })),
      ccRecipients: (input.cc ?? []).map((address) => ({
        emailAddress: { address },
      })),
    }),
  });

  if (!draftResponse.ok) {
    throw new Error(
      `Graph draft creation failed: ${draftResponse.status} ${await draftResponse.text()}`,
    );
  }

  const draft = await draftResponse.json();
  const messageId: string = draft.id;

  for (const attachment of input.attachments ?? []) {
    const attachResponse = await graphFetch(
      `/users/${mailbox}/messages/${messageId}/attachments`,
      {
        method: "POST",
        body: JSON.stringify({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: attachment.name,
          contentType: attachment.contentType,
          contentBytes: attachment.contentBytes,
        }),
      },
    );
    if (!attachResponse.ok) {
      throw new Error(
        `Graph attachment upload failed for ${attachment.name}: ${attachResponse.status} ${await attachResponse.text()}`,
      );
    }
  }

  const sendResponse = await graphFetch(
    `/users/${mailbox}/messages/${messageId}/send`,
    { method: "POST" },
  );
  if (!sendResponse.ok) {
    throw new Error(
      `Graph send failed: ${sendResponse.status} ${await sendResponse.text()}`,
    );
  }

  return {
    messageId,
    conversationId: draft.conversationId ?? null,
    internetMessageId: draft.internetMessageId ?? null,
  };
}
