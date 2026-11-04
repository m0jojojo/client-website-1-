/**
 * Runs a Prisma database command against the PRODUCTION database, using the connection strings in
 * .env.production.local (never your development .env.local). Usage:
 *   npm run db:deploy:prod    apply migrations
 *   npm run db:status:prod    show which migrations are applied
 *   npm run db:seed:prod      load the catalog (refuses if customers already exist)
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { describeDatabaseUrl } from "./lib/db-url";

const FILE = ".env.production.local";
const COMMANDS: Record<string, string[]> = {
  deploy: ["prisma", "migrate", "deploy"],
  status: ["prisma", "migrate", "status"],
  seed: ["prisma", "db", "seed"],
};

const which = process.argv[2];
if (!which || !COMMANDS[which]) {
  console.error(`Usage: tsx scripts/prod-db.ts <${Object.keys(COMMANDS).join("|")}>`);
  process.exit(1);
}
if (!existsSync(FILE)) {
  console.error(
    `${FILE} not found. Create it with the production DATABASE_URL and DATABASE_URL_UNPOOLED (see docs/deployment.md).`,
  );
  process.exit(1);
}

const env = parse(readFileSync(FILE));
const pooled = describeDatabaseUrl(env.DATABASE_URL);
const direct = describeDatabaseUrl(env.DATABASE_URL_UNPOOLED);
if (!pooled || !direct) {
  console.error(`${FILE} must contain valid DATABASE_URL and DATABASE_URL_UNPOOLED values.`);
  process.exit(1);
}
const dev = parse(existsSync(".env.local") ? readFileSync(".env.local") : "");
const devHost = describeDatabaseUrl(dev.DATABASE_URL)?.host;
if (devHost && (pooled.host === devHost || direct.host === devHost)) {
  console.error(
    `Refusing to run: the production file points at the same database server as your development file (${devHost}).\n` +
      `Use a separate Neon branch or project for the live site.`,
  );
  process.exit(1);
}

console.log(`Target database: ${direct.host} / ${direct.database}  (from ${FILE})`);
const result = spawnSync("npx", COMMANDS[which], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...env,
    DATABASE_URL: env.DATABASE_URL,
    DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED,
  },
});
process.exit(result.status ?? 1);
