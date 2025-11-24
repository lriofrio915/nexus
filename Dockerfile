# ==========================================
# ETAPA 1: Construcción (Builder)
# Usamos una imagen de Node ligera para compilar
# ==========================================
FROM node:20-alpine as builder

# Definimos el directorio de trabajo dentro del contenedor
WORKDIR /app

# 1. Copiamos los archivos de dependencias primero
# Esto optimiza la construcción: Docker no volverá a instalar 
# dependencias si el package.json no ha cambiado.
COPY package.json package-lock.json ./

# 2. Instalamos las dependencias del proyecto
RUN npm install

# 3. COPIADO INTELIGENTE DEL CÓDIGO
# Copiamos todo el código fuente desde la carpeta que descargó Easypanel/Railway.
# Al usar COPY . . evitamos problemas de caché de git clone y aseguramos
# que siempre se construya la versión más reciente de tu código.
COPY . .

# 4. Compilamos la aplicación React
# Esto genera la carpeta 'dist' con los archivos estáticos listos para producción.
RUN npm run build

# ==========================================
# ETAPA 2: Servidor de Producción (Nginx)
# Usamos Nginx para servir los archivos estáticos (mucho más rápido y ligero)
# ==========================================
FROM nginx:alpine

# 5. Copiamos los archivos compilados (la carpeta dist) desde la Etapa 1
# Los colocamos en la carpeta estándar donde Nginx busca archivos web.
COPY --from=builder /app/dist /usr/share/nginx/html

# 6. CONFIGURACIÓN CRÍTICA DE NGINX
# Copiamos tu archivo nginx.conf personalizado.
# Esto es vital para que React maneje las rutas (evita error 404 al recargar)
# y para que el servidor escuche correctamente en el puerto 80.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 7. Exponemos el puerto 80
# Le dice a la nube (Easypanel) qué puerto debe mapear hacia internet.
EXPOSE 80

# 8. Arrancamos el servidor Nginx
CMD ["nginx", "-g", "daemon off;"]