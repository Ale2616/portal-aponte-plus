"use client";

import { useState, useEffect } from "react";
import { Bell, BellRing, CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

interface PushNotificationCardProps {
  cedula: string;
  idServicio?: string;
  className?: string;
  onSubscribed?: () => void;
  variant?: "banner" | "modal" | "compact";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationCard({
  cedula,
  idServicio,
  className = "",
  onSubscribed,
  variant = "banner",
}: PushNotificationCardProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);
        if (Notification.permission === "granted") {
          setIsSubscribed(true);
        }
      }

      // Comprobar si el usuario la descartó en esta sesión
      const dismissed = sessionStorage.getItem(`push_dismissed_${cedula}`);
      if (dismissed) {
        setIsDismissed(true);
      }
    }
  }, [cedula]);

  const handleSubscribe = async () => {
    if (!isSupported) {
      toast.error("Tu navegador no soporta Notificaciones Push Web.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Pedir permiso al usuario
      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);

      if (requestedPermission !== "granted") {
        toast.info("Permiso no concedido", {
          description: "Puedes activar las notificaciones desde la configuración de tu navegador.",
        });
        setIsLoading(false);
        return;
      }

      // 2. Clave pública VAPID
      const vapidPublicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        "BFSzM8wajctH6kO4PLnZSWkByuDGcnB-DaDhQH8a5O3GJ9zH5WM5Lcni_KUxalp8f4r5EAWcfx01bQrAe8SSK_E";

      if (!vapidPublicKey) {
        throw new Error("Clave pública VAPID no encontrada.");
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // 3. Esperar a que el service worker esté listo
      const registration = await navigator.serviceWorker.ready;

      // 4. Obtener o crear la suscripción
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // 5. Enviar suscripción al backend con la cédula del cliente
      const response = await fetch("/api/notificaciones/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cedula: String(cedula).trim(),
          id_servicio: idServicio ? String(idServicio).trim() : undefined,
          subscription: subscription.toJSON(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar la suscripción en el servidor.");
      }

      setIsSubscribed(true);
      toast.success("¡Notificaciones activadas!", {
        description: "Te avisaremos apenas validemos tu pago.",
        duration: 6000,
      });

      if (onSubscribed) {
        onSubscribed();
      }
    } catch (error: any) {
      console.error("[Push Subscription Error]:", error);
      toast.error("Error al activar notificaciones", {
        description: error.message || "Por favor verifica los permisos en tu navegador.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`push_dismissed_${cedula}`, "true");
    }
  };

  // Si no está soportado o fue descartado, no mostrar nada
  if (!isSupported || isDismissed) {
    return null;
  }

  // Si ya está suscrito y tiene permiso concedido
  if (isSubscribed && permission === "granted") {
    if (variant === "compact") {
      return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 ${className}`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Alertas de pago activas</span>
        </div>
      );
    }

    return (
      <div className={`p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 flex items-center justify-between gap-3 text-xs ${className}`}>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <BellRing className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-emerald-800 dark:text-emerald-300">
              Notificaciones Push Activas
            </p>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
              Recibirás una alerta en este dispositivo cuando tu pago sea confirmado.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-3 h-3" />
          Conectado
        </span>
      </div>
    );
  }

  // Si el usuario bloqueó el permiso en el navegador
  if (permission === "denied") {
    return null;
  }

  return (
    <div
      className={`relative overflow-hidden p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-50 via-indigo-50/60 to-emerald-50/50 dark:from-slate-800/90 dark:via-indigo-950/20 dark:to-slate-900 border border-sky-200/80 dark:border-slate-700/80 shadow-md ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-sky-500 text-white shadow-md shadow-sky-500/20 shrink-0">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>¿Deseas recibir una notificación en tu teléfono cuando aprobemos tu pago?</span>
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300">
              Te avisaremos en tiempo real apenas nuestro equipo valide tu comprobante bancario.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
            title="Ahora no"
          >
            <X className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleSubscribe}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 active:scale-95 text-white shadow-md shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Activando...</span>
              </>
            ) : (
              <>
                <BellRing className="w-3.5 h-3.5" />
                <span>Activar Notificaciones</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
