FROM node:22-alpine AS builder
WORKDIR /app
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
ARG METABO_API_PORT=47822
COPY nginx.conf /tmp/nginx.conf
RUN sed "s/API_PORT_PLACEHOLDER/${METABO_API_PORT}/g" /tmp/nginx.conf > /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
