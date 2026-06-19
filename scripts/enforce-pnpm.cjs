#!/usr/bin/env node

const userAgent = process.env.npm_config_user_agent || "";
const isPnpm = userAgent.includes("pnpm/");

if (!isPnpm) {
  console.error("\nThis repository is managed with pnpm.");
  console.error("Use: corepack pnpm install\n");
  process.exit(1);
}
