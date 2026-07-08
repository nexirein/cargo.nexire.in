import "server-only";
import { Client } from "@upstash/qstash";

let client: Client | null = null;

export function getQStashClient(): Client {
  if (!client) {
    client = new Client({ token: process.env.QSTASH_TOKEN! });
  }
  return client;
}
