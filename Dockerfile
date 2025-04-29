# Etapa 1: Construir la aplicación Angular
FROM node:18 AS build

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar el package.json y package-lock.json
COPY package*.json ./

# Instalar las dependencias
RUN npm install

# Copiar el código fuente
COPY . .

# Construir la aplicación para producción
RUN npm run build

# Etapa 2: Servir la aplicación con Nginx
FROM nginx:alpine

# Copiar los archivos construidos desde la etapa anterior
COPY --from=build /app/dist/listado-app /usr/share/nginx/html

# Exponer el puerto 4200
EXPOSE 4200

# Iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
