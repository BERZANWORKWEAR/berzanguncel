import crypto from "crypto";

import {
  clearOutlookIntegration,
  getOutlookIntegration,
  saveOutlookIntegration,
} from "./erp-store.js";

const pendingStates = new Map();
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_SCOPES = ["openid", "profile", "offline_access", "User.Read", "Mail.Read", "Mail.Send"];

function nowIso() {
  return new Date().toISOString();
}

function getConfig(port = 8787) {
  const scopes = String(process.env.OUTLOOK_SCOPES || DEFAULT_SCOPES.join(" "))
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return {
    tenantId: String(process.env.OUTLOOK_TENANT_ID || "common").trim(),
    clientId: String(process.env.OUTLOOK_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.OUTLOOK_CLIENT_SECRET || "").trim(),
    redirectUri: String(process.env.OUTLOOK_REDIRECT_URI || `http://localhost:${port}/api/admin/integrations/outlook/callback`).trim(),
    scopes,
    secretKey: String(process.env.OUTLOOK_TOKEN_SECRET || process.env.ADMIN_PASSWORD || process.env.OUTLOOK_CLIENT_SECRET || "berzan-outlook").trim(),
  };
}

function isConfigured(port) {
  const config = getConfig(port);
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

function getAuthBase(port) {
  const { tenantId } = getConfig(port);
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`;
}

function requireConfigured(port) {
  if (!isConfigured(port)) {
    throw new Error("Outlook entegrasyonu için OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET ve OUTLOOK_REDIRECT_URI tanımlanmalı.");
  }
}

function createKey(secret) {
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(value, secret) {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", createKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decrypt(value, secret) {
  if (!value) return "";
  const [version, iv, tag, payload] = String(value).split(".");
  if (version !== "v1" || !iv || !tag || !payload) return "";
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    createKey(secret),
    Buffer.from(iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

async function tokenRequest(params, port) {
  requireConfigured(port);
  const config = getConfig(port);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    ...params,
  });

  const response = await fetch(`${getAuthBase(port)}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Microsoft token alınamadı.");
  }

  return data;
}

function rememberState(payload) {
  const state = crypto.randomBytes(24).toString("hex");
  pendingStates.set(state, {
    ...payload,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  return state;
}

function consumeState(state) {
  const entry = pendingStates.get(state);
  pendingStates.delete(state);
  if (!entry || entry.expiresAt < Date.now()) {
    throw new Error("Outlook bağlantı oturumu zaman aşımına uğradı. Tekrar bağlanmayı deneyin.");
  }
  return entry;
}

function getSafeIntegration(payload = {}) {
  return {
    configured: false,
    connected: Boolean(payload.connected),
    accountEmail: payload.accountEmail || "",
    displayName: payload.displayName || "",
    scopes: Array.isArray(payload.scopes) ? payload.scopes : [],
    connectedAt: payload.connectedAt || "",
    lastSyncAt: payload.lastSyncAt || "",
    accessTokenExpiresAt: payload.accessTokenExpiresAt || "",
  };
}

async function graphFetch(path, options = {}, port) {
  const accessToken = await ensureAccessToken(port);
  const response = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "Microsoft Graph isteği başarısız.");
  }
  return data;
}

export async function getOutlookStatus(port) {
  const integration = await getOutlookIntegration();
  return {
    ...getSafeIntegration(integration),
    configured: isConfigured(port),
  };
}

export async function createOutlookConnectUrl(originHint = "", port) {
  requireConfigured(port);
  const config = getConfig(port);
  const state = rememberState({ originHint });
  const authUrl = new URL(`${getAuthBase(port)}/authorize`);

  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", config.scopes.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  return authUrl.toString();
}

export async function completeOutlookConnection({ code, state, error, errorDescription }, port) {
  if (error) {
    throw new Error(errorDescription || error || "Microsoft oturumu iptal edildi.");
  }
  if (!code || !state) {
    throw new Error("Microsoft dönüş kodu eksik.");
  }

  consumeState(state);
  const config = getConfig(port);
  const tokenData = await tokenRequest(
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(" "),
    },
    port
  );

  const profile = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || "Microsoft profil bilgisi alınamadı.");
    return data;
  });

  const accountEmail = String(profile.mail || profile.userPrincipalName || "").trim();
  const displayName = String(profile.displayName || accountEmail || "Microsoft Hesabı").trim();
  const expiresAt = new Date(Date.now() + Math.max(60, Number(tokenData.expires_in || 3600) - 120) * 1000).toISOString();
  const integration = await saveOutlookIntegration({
    connected: true,
    accountEmail,
    displayName,
    scopes: String(tokenData.scope || config.scopes.join(" "))
      .split(/\s+/)
      .filter(Boolean),
    connectedAt: nowIso(),
    lastSyncAt: nowIso(),
    accessToken: encrypt(tokenData.access_token, config.secretKey),
    refreshToken: encrypt(tokenData.refresh_token || "", config.secretKey),
    accessTokenExpiresAt: expiresAt,
  });

  return getSafeIntegration(integration);
}

export async function disconnectOutlook() {
  const integration = await clearOutlookIntegration();
  return getSafeIntegration(integration);
}

export async function ensureAccessToken(port) {
  requireConfigured(port);
  const config = getConfig(port);
  const integration = await getOutlookIntegration();

  if (!integration.connected || !integration.refreshToken) {
    throw new Error("Outlook henüz bağlanmadı.");
  }

  const expiresAt = integration.accessTokenExpiresAt ? new Date(integration.accessTokenExpiresAt).getTime() : 0;
  if (integration.accessToken && expiresAt > Date.now() + 60 * 1000) {
    return decrypt(integration.accessToken, config.secretKey);
  }

  const refreshToken = decrypt(integration.refreshToken, config.secretKey);
  if (!refreshToken) {
    throw new Error("Outlook yenileme belirteci çözümlenemedi. Bağlantıyı yeniden kurun.");
  }

  const tokenData = await tokenRequest(
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(" "),
    },
    port
  );

  const nextIntegration = await saveOutlookIntegration({
    ...integration,
    connected: true,
    scopes: String(tokenData.scope || integration.scopes.join(" "))
      .split(/\s+/)
      .filter(Boolean),
    lastSyncAt: nowIso(),
    accessToken: encrypt(tokenData.access_token, config.secretKey),
    refreshToken: encrypt(tokenData.refresh_token || refreshToken, config.secretKey),
    accessTokenExpiresAt: new Date(
      Date.now() + Math.max(60, Number(tokenData.expires_in || 3600) - 120) * 1000
    ).toISOString(),
  });

  return decrypt(nextIntegration.accessToken, config.secretKey);
}

export async function listInboxMessages({ top = 8 } = {}, port) {
  const queryTop = Math.min(Math.max(Number(top || 8), 1), 25);
  const data = await graphFetch(
    `/me/mailFolders/inbox/messages?$select=id,subject,from,receivedDateTime,bodyPreview,isRead,webLink&$orderby=receivedDateTime DESC&$top=${queryTop}`,
    {},
    port
  );
  const integration = await getOutlookIntegration();
  await saveOutlookIntegration({
    ...integration,
    lastSyncAt: nowIso(),
  });
  return Array.isArray(data.value) ? data.value : [];
}

export async function sendOutlookMail(payload = {}, port) {
  const to = String(payload.to || "").trim();
  const subject = String(payload.subject || "").trim();
  const content = String(payload.content || "").trim();

  if (!to || !subject || !content) {
    throw new Error("Alıcı, konu ve içerik zorunludur.");
  }

  await graphFetch(
    "/me/sendMail",
    {
      method: "POST",
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: "Text",
            content,
          },
          toRecipients: [
            {
              emailAddress: {
                address: to,
              },
            },
          ],
        },
        saveToSentItems: true,
      }),
    },
    port
  );

  const integration = await getOutlookIntegration();
  await saveOutlookIntegration({
    ...integration,
    lastSyncAt: nowIso(),
  });

  return { ok: true };
}
