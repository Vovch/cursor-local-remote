"use client";

import { useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api-fetch";

function getInitialPermission(): NotificationPermission {
  if (typeof Notification !== "undefined") {
    return Notification.permission;
  }
  return "default";
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) {
    view[i] = raw.charCodeAt(i);
  }
  return buffer;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(getInitialPermission);
  const subscribedRef = useRef(false);

  const subscribeToPush = useCallback(async () => {
    if (subscribedRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    try {
      const reg = await navigator.serviceWorker.ready;

      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        subscribedRef.current = true;
        return;
      }

      const res = await apiFetch("/api/push/vapid-key");
      if (!res.ok) return;
      const { publicKey } = await res.json();

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await apiFetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      subscribedRef.current = true;
    } catch (err) {
      console.error("[push] Subscription failed:", err);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") {
      setPermission(Notification.permission);
      if (Notification.permission === "granted") {
        void subscribeToPush();
      }
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      void subscribeToPush();
    }
  }, [subscribeToPush]);

  const notify = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      if (!document.hidden) return;

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.active?.postMessage({
              type: "SHOW_NOTIFICATION",
              title,
              options: { icon: "/icon-192.png", ...options },
            });
          })
          .catch((err) => console.error("[notifications] SW notify failed:", err));
      }
    },
    [],
  );

  return { permission, requestPermission, notify };
}
