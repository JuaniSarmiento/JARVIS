# =========================================================
# JARVIS AI ORCHESTRATOR - DEPLOYMENT READY DOCKERFILE
# =========================================================

# --- Etapa 1: Build de la aplicación (Typescript -> JS) ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar configuración de NPM (optimizando caché)
COPY package.json package-lock.json* ./

# Instalación estricta de dependencias respetando el lockfile
RUN npm ci --legacy-peer-deps

# Copiamos el resto del código y archivos críticos 
COPY . .

# Build Typescript (genera la carpeta /dist y dashboard/out)
RUN npm run build


# --- Etapa 2: Imagen de Producción Reducida (Runtime) ---
FROM node:20-alpine AS runner

WORKDIR /app

# Instalamos el driver de Copilot-api a nivel del contenedor COOM ROOT
RUN npm install -g copilot-api@latest

# Asignar usuario no root para mejorar la seguridad
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 jarvis
RUN chown -R jarvis:nodejs /app

USER jarvis

# Copiamos solo los manifiestos de paquetes
COPY --from=builder --chown=jarvis:nodejs /app/package.json ./package.json
COPY --from=builder --chown=jarvis:nodejs /app/package-lock.json* ./

# Instalamos SOLAMENTE dependencias de producción (redactando peso de la imagen)
RUN npm ci --only=production --legacy-peer-deps

# Copiamos el build transpilado generado en la Etapa 1
COPY --from=builder --chown=jarvis:nodejs /app/dist ./dist

# Copiamos el código fuente original para permitir Autoevaluación/Introspección por parte de CoderAgent
COPY --from=builder --chown=jarvis:nodejs /app/src ./src

# Variables de Entorno base (se inyectarán/sobrescribirán desde el dashboard cloud - Railway, Render, etc.)
ENV NODE_ENV=production

# Punto de entrada de la aplicación nativo para permitir envío correcto de procesos SIGTERM
CMD ["node", "dist/index.js"]
