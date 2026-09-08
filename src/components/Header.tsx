"use client";

import { ClientProfile } from "@/lib/types";
import { branding } from "@/config/branding";
import { getServiceStatusInfo } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { InstallPWAButton } from "./InstallPWAButton";
import { LogOut, CreditCard, HelpCircle } from "lucide-react";

interface HeaderProps {
  client: ClientProfile | null;
  onLogout: () => void;
  onOpenBankAccounts: () => void;
  onOpenFaq: () => void;
}

export function Header({ client, onLogout, onOpenBankAccounts, onOpenFaq }: HeaderProps) {
  const statusInfo = client ? getServiceStatusInfo(client.estadoServicio) : null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
          <div className="relative h-10 sm:h-12 w-auto max-w-[140px] sm:max-w-[170px] flex items-center justify-center flex-shrink-0 bg-white dark:bg-slate-800/90 p-1 rounded-xl shadow-sm border border-slate-200/80 dark:border-slate-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.logoUrl}
              alt={branding.companyName}
              className="h-full w-auto object-contain rounded-lg"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {branding.companyName}
              </h1>
              <span className="hidden sm:inline-block text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Portal Clientes
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              {branding.tagline}
            </p>
          </div>
        </div>

        {/* Dynamic Client Info & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {client && statusInfo && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800">
              <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`} />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {client.nombreCompleto.split(" ")[0]} ({statusInfo.shortLabel})
              </span>
            </div>
          )}

          {/* Botón Canales de Pago */}
          <button
            onClick={onOpenBankAccounts}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Ver canales y cuentas de pago"
          >
            <CreditCard className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
            <span className="hidden sm:inline">Canales de Pago</span>
          </button>

          {/* Botón Centro de Ayuda */}
          <button
            onClick={onOpenFaq}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Preguntas frecuentes y soporte"
          >
            <HelpCircle className="w-4 h-4" strokeWidth={1.75} />
          </button>

          {/* Botón PWA */}
          <InstallPWAButton variant="header" />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Logout / Cambiar usuario */}
          {client && (
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              title="Cerrar consulta y buscar otro cliente"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
              <span>Cambiar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
