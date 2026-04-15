import { useState, useEffect, useCallback } from "react";

const PUSH_API = "https://functions.poehali.dev/843759f9-8a03-41bd-a539-41e0cdb187cc";

export type PushStatus = "unsupported" | "denied" | "granted" | "default" | "loading";

export function usePushNotifications(userId: string | null) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [subscribed, setSubscribed] = useState(false);

  const isSupported = typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window;

  useEffect(() => {
    if (!isSupported) { setStatus("unsupported"); return; }
    const perm = Notification.permission as PushStatus;
    setStatus(perm);

    // Проверяем есть ли уже активная подписка
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setSubscribed(!!sub);
      });
    }).catch(() => {});
  }, [isSupported]);

  // Навигация к заказам по сообщению от SW
  useEffect(() => {
    if (!isSupported) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "NAVIGATE_ORDERS") {
        window.dispatchEvent(new CustomEvent("navigate-orders"));
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !userId) return false;
    try {
      // Получаем VAPID public key
      const keyResp = await fetch(`${PUSH_API}?action=get_vapid_key`);
      if (!keyResp.ok) {
        console.warn("[PUSH] VAPID key not available");
        return false;
      }
      const { publicKey } = await keyResp.json();
      if (!publicKey) return false;

      // Регистрируем SW
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Запрашиваем разрешение
      const perm = await Notification.requestPermission();
      setStatus(perm as PushStatus);
      if (perm !== "granted") return false;

      // Подписываемся
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Сохраняем на сервере
      await fetch(`${PUSH_API}?action=save_subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, subscription: sub.toJSON() }),
      });

      setSubscribed(true);
      return true;
    } catch (e) {
      console.error("[PUSH] subscribe error", e);
      return false;
    }
  }, [isSupported, userId]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported || !userId) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      await fetch(`${PUSH_API}?action=delete_subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      setSubscribed(false);
    } catch (e) {
      console.error("[PUSH] unsubscribe error", e);
    }
  }, [isSupported, userId]);

  return { status, subscribed, isSupported, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
