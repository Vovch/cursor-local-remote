import webpush from "web-push";
import { getDb } from "@/lib/session-store";

interface StoredVapidKeys {
  publicKey: string;
  privateKey: string;
}

function loadOrCreateVapidKeys(): StoredVapidKeys {
  const conn = getDb();

  const row = conn.prepare("SELECT value FROM config WHERE key = 'vapid_keys'").get() as
    | { value: string }
    | undefined;

  if (row) {
    return JSON.parse(row.value) as StoredVapidKeys;
  }

  const keys = webpush.generateVAPIDKeys();
  const stored: StoredVapidKeys = {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  };

  conn.prepare("INSERT INTO config (key, value) VALUES ('vapid_keys', ?)").run(
    JSON.stringify(stored),
  );

  return stored;
}

let initialized = false;

function ensureVapid(): StoredVapidKeys {
  const keys = loadOrCreateVapidKeys();

  if (!initialized) {
    webpush.setVapidDetails("mailto:clr@localhost", keys.publicKey, keys.privateKey);
    initialized = true;
  }

  return keys;
}

export function getVapidPublicKey(): string {
  return ensureVapid().publicKey;
}

export function savePushSubscription(subscription: webpush.PushSubscription): void {
  const conn = getDb();
  conn
    .prepare(
      "INSERT OR REPLACE INTO push_subscriptions (endpoint, subscription, created_at) VALUES (?, ?, ?)",
    )
    .run(subscription.endpoint, JSON.stringify(subscription), Date.now());
}

export function removePushSubscription(endpoint: string): void {
  const conn = getDb();
  conn.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

function getAllSubscriptions(): { endpoint: string; subscription: webpush.PushSubscription }[] {
  const conn = getDb();
  const rows = conn.prepare("SELECT endpoint, subscription FROM push_subscriptions").all() as {
    endpoint: string;
    subscription: string;
  }[];
  return rows.map((r) => ({
    endpoint: r.endpoint,
    subscription: JSON.parse(r.subscription) as webpush.PushSubscription,
  }));
}

export async function notifyAllSubscribers(title: string, body: string): Promise<void> {
  ensureVapid();
  const subs = getAllSubscriptions();
  if (subs.length === 0) return;

  const payload = JSON.stringify({ title, body });

  await Promise.allSettled(
    subs.map(async ({ endpoint, subscription }) => {
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          removePushSubscription(endpoint);
        } else {
          console.error("[push] Failed to send to " + endpoint.slice(0, 60) + ":", err);
        }
      }
    }),
  );
}
