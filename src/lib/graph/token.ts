import "server-only";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { getRedis } from "@/lib/redis/client";

const GRAPH_TOKEN_CACHE_KEY = "graph:app-token";

let msalApp: ConfidentialClientApplication | null = null;

function getMsalApp(): ConfidentialClientApplication {
  if (!msalApp) {
    msalApp = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.AZURE_AD_CLIENT_ID!,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      },
    });
  }
  return msalApp;
}

/**
 * App-only (client-credentials) Graph token, cached in Redis for ~55
 * minutes so concurrent send-webhook invocations share one token instead
 * of each hitting Azure AD — Graph tokens are normally valid ~60-75min.
 */
export async function getGraphAccessToken(): Promise<string> {
  const redis = getRedis();
  const cached = await redis.get<string>(GRAPH_TOKEN_CACHE_KEY);
  if (cached) return cached;

  const result = await getMsalApp().acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });

  if (!result?.accessToken) {
    throw new Error("Could not acquire a Microsoft Graph access token.");
  }

  await redis.set(GRAPH_TOKEN_CACHE_KEY, result.accessToken, { ex: 55 * 60 });
  return result.accessToken;
}
