"use client";

import { useState } from "react";
import { useConfig } from "@/context/ConfigContext";
import { AlertTriangle, Info, X } from "lucide-react";

export function GlobalAlertBanner() {
  const { config, globalSettings } = useConfig();
  const [isDismissed, setIsDismissed] = useState(false);

  const isAlertActive =
    globalSettings?.avisoGlobal !== undefined
      ? globalSettings.avisoGlobal.activo
      : config.globalAlert.enabled;
  const alertText = globalSettings?.avisoGlobal?.texto || config.globalAlert.message;

  if (!isAlertActive || isDismissed) {
    return null;
  }

  const isWarning = config.globalAlert.type === "warning";

  return (
    <div
      className={`w-full px-4 py-2.5 text-xs font-semibold flex items-center justify-between border-b transition-all animate-in slide-in-from-top-2 duration-300 ${
        isWarning
          ? "bg-amber-500/15 border-amber-500/30 text-amber-900 dark:text-amber-200"
          : "bg-sky-500/15 border-sky-500/30 text-sky-900 dark:text-sky-200"
      }`}
    >
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {isWarning ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 animate-bounce" />
          ) : (
            <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0" />
          )}
          <span className="leading-snug">{alertText}</span>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity flex-shrink-0 cursor-pointer"
          title="Ocultar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
