# Nexus — nexus-ia.com.es

Sitio y agente de IA de Nexus AI Automation.

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 3
- **Deploy:** Vercel — push a `main` dispara el despliegue
- **Producción:** https://nexus-ia.com.es

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de producción
npm run lint     # eslint
```

## Estructura

```
app/          rutas (App Router) y API routes
components/   componentes de UI
lib/          configuración del sitio y utilidades compartidas
public/       assets estáticos
```

Los datos del negocio (teléfono, textos, servicios) viven en `lib/site-config.ts`,
no hardcodeados en los componentes.

## Variables de entorno

Copiar `.env.local.example` a `.env.local` y completar. En Vercel se configuran
en Project Settings → Environment Variables.

## Historial

Migrado desde una SPA de Vite servida por Docker/Easypanel. Ver
`git log` para el detalle de la migración.
