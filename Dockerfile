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

# Copiar archivos generados desde la etapa de build
COPY --from=build /app/dist/listado-app/browser /usr/share/nginx/html

# Copiar la configuración personalizada de NGINX
COPY nginx.conf /etc/nginx/nginx.conf

# Exponer el puerto
EXPOSE 80

# Comando por defecto
CMD ["nginx", "-g", "daemon off;"]
