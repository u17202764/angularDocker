# Etapa 1: Construcción de la aplicación Angular
FROM node:18 AS build

WORKDIR /app

# Copiar el package.json y package-lock.json al contenedor
COPY package*.json ./

# Instalar las dependencias del proyecto
RUN npm install

# Copiar todo el proyecto al contenedor
COPY . .

# Instalar Angular CLI globalmente
RUN npm install -g @angular/cli

# Construir la aplicación Angular en modo producción
RUN ng build --configuration production

# Etapa 2: Servir con Nginx
FROM nginx:alpine

# Eliminar los archivos predeterminados de Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copiar los archivos generados en la etapa build al directorio de Nginx
COPY --from=build /app/dist/listado-app /usr/share/nginx/html

# Asegurarse de que los archivos copiados tienen los permisos adecuados
RUN chown -R nginx:nginx /usr/share/nginx/html && chmod -R 755 /usr/share/nginx/html

# Verificar que la carpeta sea accesible
RUN ls -la /usr/share/nginx/html

# Exponer el puerto 80 para servir la aplicación
EXPOSE 80

# Iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
