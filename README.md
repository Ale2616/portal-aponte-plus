# Portal de Autogestión y Reporte de Pagos para Clientes de ISP (Integración WispHub)

Aplicación web moderna, responsiva (mobile-first), rápida y con diseño estilo Fintech (inspirada en Nu, Revolut y Stripe) para que los abonados de un ISP consulten su estado de cuenta, revisen o descarguen sus facturas en PDF y reporten comprobantes de pago de forma inmediata.

---

## Características Principales

1. **Cero Exposición de Credenciales (Backend Proxy):**
   - La `WISPHUB_API_KEY` y endpoints internos nunca están expuestos al cliente (`NEXT_PUBLIC_` no se usa para secretos).
   - Endpoints internos seguros `/api/cliente/consultar`, `/api/facturas/reportar-pago` y `/api/facturas/[id]/pdf`.
2. **Acceso Ágil y Magic Link:**
   - Consulta con Cédula / DNI sin contraseñas engorrosas.
   - Soporte para Magic Link en la URL: `http://localhost:3000/?cedula=1020304050`. Ideal para enlaces automáticos enviados por SMS o WhatsApp por el ISP.
   - Cuentas Demo preconfiguradas con 1 clic para probar de inmediato.
3. **Diseño Fintech Ultra-Premium (Dark/Light Mode):**
   - Tarjeta digital simulada con textura, microinteracciones, detalles de fibra óptica y chips.
   - Badges de estado del servicio en tiempo real:
     - 🟢 **Activo**
     - 🔴 **Cortado por Mora** (con banner de alerta y reconexión inmediata)
     - 🟡 **Suspendido**
   - Desglose de velocidad simétrica contratada (Bajada / Subida), ONT y Nodo OLT.
4. **Módulo de Reporte de Pago ("Subir Comprobante"):**
   - Formulario validado con **React Hook Form** + **Zod**.
   - Selector de método de pago (Nequi, Daviplata, Bancolombia, PSE, Efecty) con copia de número de cuenta en 1 clic.
   - Subida de comprobante por **Drag & Drop**, selector o **cámara del celular**.
   - Previsualización y validación estricta de peso (<5MB) y formato (JPG, PNG, WebP, PDF).
   - Generación de código de radicado único (`RAD-2026-XXXXX`), confeti de celebración y estado "Pago en Revisión".
5. **Botón Flotante Persistente de WhatsApp:**
   - Redirige directamente al chat de soporte con mensaje pre-rellenado y personalizado con el nombre y cédula del abonado.
6. **Configuración Centralizada de Marca (`branding.ts`):**
   - Personaliza fácilmente el nombre del ISP, NIT, teléfonos, métodos de pago, colores y preguntas frecuentes.

---

## Cuentas Demo para Pruebas Inmediatas

| Cédula / Documento | Nombre Abonado | Estado | Saldo Pendiente | Caso de Uso |
|---|---|---|---|---|
| `1020304050` | Juan Carlos Rodríguez | 🟢 Activo | $ 85.000 COP | 1 Factura por vencer + historial pagadas |
| `9876543210` | María Elena Restrepo | 🔴 Cortado | $ 190.000 COP | Mora acumulada + alerta de reconexión |
| `1122334455` | Carlos Andrés Gómez | 🟢 Activo | $ 0 COP | Cuenta al día sin deuda |

*Nota: Cualquier otro número de cédula ingresado generará un abonado dinámico para permitir pruebas libres.*

---

## Variables de Entorno (`.env.local`)

```env
# Llave de API de WispHub (opcional para pruebas; si está vacía, opera en modo Mock Demo)
WISPHUB_API_KEY=

# URL Base de la API de WispHub
WISPHUB_API_URL=https://api.wisphub.net/api

# Forzar modo Mock/Demo para desarrollo
WISPHUB_MOCK_MODE=true
```

---

## Ejecución Local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# O compilar y ejecutar en producción:
npm run build
npm run start
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.
