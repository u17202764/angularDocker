# Etapa 1: Construcción de la aplicación Angular
FROM node:18-alpine AS build

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos necesarios para instalación
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto de la aplicación
COPY . .

# Instalar Angular CLI (si es necesario)
RUN npm install -g @angular/cli

# Compilar la aplicación Angular en modo producción
RUN ng build --configuration production

# Etapa 2: Servir aplicación con NGINX
FROM nginx:alpine

# Eliminar contenido por defecto de NGINX
RUN rm -rf /usr/share/nginx/html/*

# Copiar archivos compilados desde la etapa anterior
COPY --from=build /app/dist/* /usr/share/nginx/html

# Copiar configuración personalizada de NGINX (si tienes una)
# COPY nginx.conf /etc/nginx/nginx.conf

# Ajustar permisos para evitar errores 401/403
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Exponer el puerto 80
EXPOSE 80

# Comando por defecto de NGINX
CMD ["nginx", "-g", "daemon off;"]

