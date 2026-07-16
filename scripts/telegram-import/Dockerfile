# Раванди тӯлонии scheduler.ts (на бутун лоиҳаи Next.js — танҳо ин скрипт).
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm install tsx telegram openai input node-cron @supabase/supabase-js

COPY scripts/telegram-import ./scripts/telegram-import

# .env.local ро дар вақти run бо -v ё --env-file пайваст кунед — ба image
# ҳаргиз нанависед (TELEGRAM_SESSION калиди пурраи ҳисоб аст).
CMD ["npx", "tsx", "scripts/telegram-import/scheduler.ts"]
