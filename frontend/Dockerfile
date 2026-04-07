FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Vite bakes env at build time; .env is dockerignored — use ARG or docker-compose build.args
ARG VITE_API_BASE_URL=http://localhost:5001/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build
RUN npm install -g serve

EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]

