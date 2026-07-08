import "server-only";
import { Redis } from "@upstash/redis";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = Redis.fromEnv();
  }
  return client;
}
