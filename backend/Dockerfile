FROM node:22-alpine

# Prisma requires OpenSSL to connect to Supabase over SSL
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files and Prisma schema first because `npm ci` triggers `prisma generate`
COPY package*.json prisma.config.* ./
COPY prisma ./prisma
RUN npm ci

# Copy the rest of the backend source code
COPY . .

EXPOSE 3000
CMD ["node", "app.js"]
