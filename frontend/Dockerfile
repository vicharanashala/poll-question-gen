FROM node:18

RUN npm install -g pnpm@10.4.1

WORKDIR /app

COPY . .
COPY .npmrc ./                          

RUN pnpm install

RUN pnpm build

CMD ["pnpm", "preview", "--host", "--port", "5173"]