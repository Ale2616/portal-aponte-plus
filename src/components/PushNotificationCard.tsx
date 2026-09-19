"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  BellRing,
  CheckCircle2,
  Loader2,
  Send,
  X,
  AlertTriangle,
  ShieldAlert,
  Info,
} from "lucide-react";
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
  const [isTesting, setIsTesting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [localDiagnosticWarning, setLocalDiagnosticWarning] = useState<string | null>(null);
  const [serverDiagnosticError, setServerDiagnosticError] = useState<string | null>(null);

  // Obtener clave pública VAPID limpia
  const getCleanVapidPublicKey = () => {
    const raw =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      "BFSzM8wajctH6kO4PLnZSWkByuDGcnB-DaDhQH8a5O3GJ9zH5WM5Lcni_KUxalp8f4r5EAWcfx01bQrAe8SSK_E";
    return raw.trim().replace(/^["']|["']$/g, "");
  };

  // Sincroniza la suscripción activa con el servidor asegurando la vinculación cédula <-> subscription
  const syncSubscriptionWithServer = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      const vapidPublicKey = getCleanVapidPublicKey();

      if (!subscription && vapidPublicKey && Notification.permission === "granted") {
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      if (subscription && cedula) {
        setIsSubscribed(true);
        const subJson = subscription.toJSON();
        if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
          await fetch("/api/push/save-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cedula: String(cedula).trim(),
              id_servicio: idServicio ? String(idServicio).trim() : undefined,
              subscription: subJson,
            }),
          });
          return true;
        }
      }
    } catch (error) {
      console.warn("[Push Sync Warning]:", error);
    }
    return false;
  }, [cedula, idServicio]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      setIsSupported(supported);

      if (supported) {
        const currentPerm = Notification.permission;
        setPermission(currentPerm);

        if (currentPerm === "granted" && cedula) {
          syncSubscriptionWithServer();
        }
      }

      // Comprobar si el usuario la descartó en esta sesión
      const dismissed = sessionStorage.getItem(`push_dismissed_${cedula}`);
      if (dismissed) {
        setIsDismissed(true);
      }
    }
  }, [cedula, syncSubscriptionWithServer]);

  const handleSubscribe = async () => {
    if (!isSupported) {
      toast.error("Tu navegador no soporta Notificaciones Push Web.");
      return;
    }

    setIsLoading(true);
    setLocalDiagnosticWarning(null);
    setServerDiagnosticError(null);

    try {
      // 1. Pedir permiso al usuario
      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);

      if (requestedPermission !== "granted") {
        const warnMsg =
          "⚠️ Tu navegador o sistema operativo (Windows/Android) tiene las notificaciones bloqueadas. Habilítalas en Ajustes > Aplicaciones > Chrome > Notificaciones.";
        setLocalDiagnosticWarning(warnMsg);
        toast.info("Permiso no concedido", { description: warnMsg });
        setIsLoading(false);
        return;
      }

      // 2. Clave pública VAPID limpia
      const vapidPublicKey = getCleanVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // 3. Esperar a que el service worker esté listo
      const registration = await navigator.serviceWorker.ready;

      // 4. Obtener o crear la suscripción activa
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // 5. Enviar suscripción inmediatamente a /api/push/save-subscription con la cédula del cliente
      const response = await fetch("/api/push/save-subscription", {
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
        description: "Te avisaremos en tiempo real apenas validemos tu pago.",
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

  /**
   * Diagnóstico real en el botón "Probar notificación en este dispositivo":
   * 1. Prueba LOCAL inmediata con reg.showNotification para validar SO y pantalla.
   * 2. Si falla la alerta local, muestra advertencia en rojo.
   * 3. Si funciona la local, dispara push desde backend; si este falla, diagnostica credenciales VAPID.
   */
  const handleTestNotification = async () => {
    if (!cedula) {
      toast.error("Cédula no disponible para la prueba.");
      return;
    }

    setIsTesting(true);
    setLocalDiagnosticWarning(null);
    setServerDiagnosticError(null);
    const toastId = toast.loading("Ejecutando prueba de pantalla y canal push...");

    try {
      // ─────────────────────────────────────────────────────────────────
      // PASO 1: Diagnóstico LOCAL inmediato en pantalla
      // ─────────────────────────────────────────────────────────────────
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
        throw new Error("Este dispositivo no tiene soporte para notificaciones.");
      }

      let currentPerm = Notification.permission;
      if (currentPerm === "default") {
        currentPerm = await Notification.requestPermission();
        setPermission(currentPerm);
      }

      if (currentPerm !== "granted") {
        const warningMsg =
          "⚠️ Tu navegador o sistema operativo (Windows/Android) tiene las notificaciones bloqueadas. Habilítalas en Ajustes > Aplicaciones > Chrome > Notificaciones.";
        setLocalDiagnosticWarning(warningMsg);
        toast.error("Notificaciones bloqueadas", { id: toastId, description: warningMsg, duration: 8000 });
        setIsTesting(false);
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("🔔 Prueba de Pantalla", {
          body: "Si ves este mensaje, tu navegador y tu sistema operativo permiten notificaciones.",
          icon: "/icon.png",
          badge: "/icon.png",
          tag: "prueba-pantalla-" + Date.now(),
          requireInteraction: true,
        });
        console.log("[Push Test] Prueba de pantalla local disparada con éxito.");
      } catch (localErr: any) {
        console.error("[Push Local Diagnostic Error]:", localErr);
        const warningMsg =
          "⚠️ Tu navegador o sistema operativo (Windows/Android) tiene las notificaciones bloqueadas. Habilítalas en Ajustes > Aplicaciones > Chrome > Notificaciones.";
        setLocalDiagnosticWarning(warningMsg);
        toast.error("Alerta de pantalla bloqueada", { id: toastId, description: warningMsg, duration: 9000 });
        setIsTesting(false);
        return;
      }

      // ─────────────────────────────────────────────────────────────────
      // PASO 2: Diagnóstico del canal Push Remoto (Backend + VAPID)
      // ─────────────────────────────────────────────────────────────────
      const vapidPublicKey = getCleanVapidPublicKey();
      const registration = await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();

      if (!sub && vapidPublicKey) {
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      if (sub) {
        setIsSubscribed(true);
        const subJson = sub.toJSON();
        if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
          await fetch("/api/push/save-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cedula: String(cedula).trim(),
              id_servicio: idServicio ? String(idServicio).trim() : undefined,
              subscription: subJson,
            }),
          });
        }
      }

      // 3. Enviar notificación push al backend
      const response = await fetch("/api/notificaciones/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cedula: String(cedula).trim(),
          id_servicio: idServicio ? String(idServicio).trim() : undefined,
          isTest: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const serverErrorMsg = `⚠️ La prueba local funcionó, pero el push del servidor no llegó (${data.error || "Fallo en backend"}). El fallo reside en las credenciales VAPID del backend.`;
        setServerDiagnosticError(serverErrorMsg);
        console.error("[Push Test Backend Error]:", data.error);
        toast.error("Error en Push del Servidor", {
          id: toastId,
          description: serverErrorMsg,
          duration: 9000,
        });
        return;
      }

      toast.success("¡Prueba completada con éxito!", {
        id: toastId,
        description: "Tu pantalla y el servidor push están sincronizados y funcionando.",
        duration: 6000,
      });
    } catch (error: any) {
      console.error("[Push Test Global Error]:", error);
      toast.error("Error en la prueba de push", {
        id: toastId,
        description: error.message || "Verifica que tengas los permisos concedidos.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`push_dismissed_${cedula}`, "true");
    }
  };

  // Si el navegador no soporta ServiceWorker / Push
  if (!isSupported) {
    return null;
  }

  // Si el usuario bloqueó el permiso en el navegador o sistema
  if (permission === "denied" || localDiagnosticWarning) {
    return (
      <div
        className={`p-4 rounded-3xl bg-rose-50/90 dark:bg-rose-950/30 border border-rose-300/80 dark:border-rose-800/60 shadow-sm text-xs space-y-2.5 ${className}`}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-rose-900 dark:text-rose-200">
              Notificaciones bloqueadas en el dispositivo
            </p>
            <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
              ⚠️ Tu navegador o sistema operativo (Windows/Android) tiene las notificaciones bloqueadas. Habilítalas en Ajustes &gt; Aplicaciones &gt; Chrome &gt; Notificaciones.
            </p>
            <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80">
              En Windows: Configuración &gt; Sistema &gt; Notificaciones (desactiva &quot;No molestar&quot; / Asistente de concentración).
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleTestNotification}
            disabled={isTesting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isTesting ? "Reintentando prueba..." : "Reintentar prueba de pantalla"}
          </button>
        </div>
      </div>
    );
  }

  // Si el usuario la descartó voluntariamente
  if (isDismissed) {
    return null;
  }

  // Si ya está suscrito y tiene permiso concedido
  if (isSubscribed && permission === "granted") {
    if (variant === "compact") {
      return (
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 ${className}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Alertas de pago activas</span>
          <button
            type="button"
            onClick={handleTestNotification}
            disabled={isTesting}
            className="ml-1 hover:underline text-[10px] text-emerald-700 dark:text-emerald-300 font-bold cursor-pointer disabled:opacity-50"
            title="Probar notificación en este dispositivo"
          >
            {isTesting ? "Probando..." : "Probar"}
          </button>
        </div>
      );
    }

    return (
      <div
        className={`p-4 rounded-3xl bg-emerald-50/90 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 shadow-xs flex flex-col gap-3 text-xs ${className}`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-emerald-900 dark:text-emerald-200">
                  Notificaciones Push Activas
                </p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  Conectado
                </span>
              </div>
              <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 mt-0.5">
                Recibirás una alerta en este dispositivo cuando tu pago sea confirmado.
              </p>
            </div>
          </div>

          {/* Botón de Diagnóstico y Prueba en este dispositivo */}
          <button
            type="button"
            onClick={handleTestNotification}
            disabled={isTesting}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-emerald-900/40 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0 self-end sm:self-center"
            title="Ejecuta una prueba inmediata en pantalla y valida el canal de entrega"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Probando pantalla y servidor...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Probar notificación en este dispositivo</span>
              </>
            )}
          </button>
        </div>

        {/* Diagnóstico en rojo si la prueba local falló */}
        {localDiagnosticWarning && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p>{localDiagnosticWarning}</p>
              <p className="text-[10px] font-normal opacity-85">
                Revisa que Windows o Android no tenga activado el modo &quot;No molestar&quot;.
              </p>
            </div>
          </div>
        )}

        {/* Diagnóstico en ámbar si la prueba local funcionó pero el backend VAPID falló */}
        {serverDiagnosticError && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p>{serverDiagnosticError}</p>
          </div>
        )}
      </div>
    );
  }

  // Estado inicial: Invitar al usuario a activar notificaciones
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
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
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
