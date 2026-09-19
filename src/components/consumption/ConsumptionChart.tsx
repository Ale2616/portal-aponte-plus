"use client";

import { useEffect, useRef, useState } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from "chart.js";

// Registrar módulos necesarios de Chart.js
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export interface ChartDataPoint {
  label: string; // Etiqueta eje X (ej: "Lun 15", "04:00", "Ene")
  fullLabel?: string; // Etiqueta descriptiva para tooltip (ej: "Lunes 15 de Septiembre")
  downloadGb: number;
  uploadGb: number;
  totalGb?: number;
  extraInfo?: string; // Ej: "$65.000 COP"
}

interface ConsumptionChartProps {
  data: ChartDataPoint[];
  periodLabel?: string; // Ej: "Últimos 7 días", "Últimas 24 horas"
  isYearly?: boolean; // Si es historial por año
}

export function ConsumptionChart({ data, periodLabel, isYearly = false }: ConsumptionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detección reactiva de modo oscuro
  useEffect(() => {
    const checkDark = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDark();

    const observer = new MutationObserver(() => checkDark());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Determinar unidad de normalización (MiB vs GB)
  const maxGb = Math.max(
    0.01,
    ...data.map((d) => Math.max(d.downloadGb, d.uploadGb, d.totalGb || (d.downloadGb + d.uploadGb)))
  );

  // Si el valor máximo es menor a 1.2 GB, normalizar a MiB para mayor precisión visual
  const useMib = maxGb < 1.2 && !isYearly;
  const unitLabel = useMib ? "MiB" : "GiB";
  const multiplier = useMib ? 1024 : 1;

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destruir gráfico anterior si existe
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Colores temáticos acordes a modo claro/oscuro
    const gridColor = isDarkMode ? "rgba(148, 163, 184, 0.08)" : "rgba(100, 116, 139, 0.08)";
    const tickColor = isDarkMode ? "#94a3b8" : "#64748b";
    const tooltipBg = isDarkMode ? "#0f172a" : "#1e293b";
    const tooltipBorder = isDarkMode ? "#334155" : "#475569";

    const labels = data.map((d) => d.label);
    const downloadData = data.map((d) => Number((d.downloadGb * multiplier).toFixed(useMib ? 0 : 2)));
    const uploadData = data.map((d) => Number((d.uploadGb * multiplier).toFixed(useMib ? 0 : 2)));

    const chartData: ChartData<"bar"> = {
      labels,
      datasets: [
        {
          label: "Descarga (Rx)",
          data: downloadData,
          backgroundColor: isDarkMode ? "rgba(14, 165, 233, 0.85)" : "rgba(2, 132, 199, 0.9)",
          hoverBackgroundColor: isDarkMode ? "rgba(56, 189, 248, 1)" : "rgba(14, 165, 233, 1)",
          borderColor: isDarkMode ? "#38bdf8" : "#0284c7",
          borderWidth: 1,
          borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
          maxBarThickness: isYearly ? 28 : 24,
          categoryPercentage: 0.85,
          barPercentage: 0.8,
        },
        {
          label: "Subida (Tx)",
          data: uploadData,
          backgroundColor: isDarkMode ? "rgba(249, 115, 22, 0.85)" : "rgba(234, 88, 12, 0.9)",
          hoverBackgroundColor: isDarkMode ? "rgba(251, 146, 60, 1)" : "rgba(249, 115, 22, 1)",
          borderColor: isDarkMode ? "#fb923c" : "#ea580c",
          borderWidth: 1,
          borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
          maxBarThickness: isYearly ? 28 : 24,
          categoryPercentage: 0.85,
          barPercentage: 0.8,
        },
      ],
    };

    const options: ChartOptions<"bar"> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 500,
        easing: "easeOutQuart",
      },
      plugins: {
        legend: {
          display: false, // La leyenda personalizada ya existe en el header del contenedor
        },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: 12,
          cornerRadius: 12,
          titleFont: {
            family: "ui-sans-serif, system-ui, sans-serif",
            size: 13,
            weight: "bold",
          },
          bodyFont: {
            family: "ui-sans-serif, system-ui, sans-serif",
            size: 12,
            weight: "normal",
          },
          callbacks: {
            title: (items) => {
              const idx = items[0]?.dataIndex ?? 0;
              const point = data[idx];
              return point?.fullLabel || point?.label || "";
            },
            label: (context) => {
              const datasetLabel = context.dataset.label || "";
              const val = context.parsed.y ?? 0;
              return `  ${datasetLabel}: ${val.toLocaleString()} ${unitLabel}`;
            },
            afterBody: (items) => {
              const idx = items[0]?.dataIndex ?? 0;
              const point = data[idx];
              if (!point) return [];
              const total = (point.downloadGb + point.uploadGb) * multiplier;
              const lines = [
                `  Total período: ${total.toLocaleString(undefined, {
                  maximumFractionDigits: useMib ? 0 : 2,
                })} ${unitLabel}`,
              ];
              if (point.extraInfo && !point.extraInfo.toLowerCase().includes("factura") && !point.extraInfo.includes("$")) {
                lines.push(`  ${point.extraInfo}`);
              }
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: tickColor,
            font: {
              family: "ui-sans-serif, system-ui, sans-serif",
              size: 11,
              weight: "bold",
            },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12,
          },
          border: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: gridColor,
          },
          ticks: {
            color: tickColor,
            font: {
              family: "ui-sans-serif, system-ui, sans-serif",
              size: 10,
            },
            callback: (val) => `${val} ${unitLabel}`,
          },
          border: {
            display: false,
          },
        },
      },
    };

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: chartData,
      options,
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [data, isDarkMode, isYearly, multiplier, unitLabel, useMib]);

  return (
    <div className="w-full">
      {/* Contenedor responsivo del canvas de Chart.js */}
      <div className="relative w-full h-56 sm:h-64 md:h-72">
        <canvas ref={canvasRef} />
      </div>

      {/* Pie informativo de escala y normalización */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 font-sans">
        <span>
          Eje Y normalizado en <strong className="text-slate-700 dark:text-slate-300">{unitLabel}</strong>
          {useMib && " (Megabytes normalizados MiB / 1024)"}
        </span>
        {periodLabel && (
          <span className="font-medium text-slate-600 dark:text-slate-300">{periodLabel}</span>
        )}
      </div>
    </div>
  );
}
