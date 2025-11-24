# --- Etapa 1: Construcción (Build) ---
FROM node:20-alpine as builder

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias primero (para aprovechar el caché de Docker)
COPY package.json package-lock.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código fuente
COPY . .

# Construir la aplicación (esto crea la carpeta 'dist')
RUN npm run build

# --- Etapa 2: Servidor de Producción (Nginx) ---
FROM nginx:alpine

# Copiar los archivos construidos (la carpeta dist) al servidor Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# IMPORTANTE: Copiar configuración personalizada de Nginx
# Esta línea es vital para que Railway detecte el puerto y maneje las rutas de React
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer el puerto 80
EXPOSE 80

# Iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]