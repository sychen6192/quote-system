import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Real environment variables win over .env. override is pinned because
// dotenv 18 would otherwise take it from a DOTENV_OVERRIDE shell variable.
dotenv.config({ path: ".env", quiet: true, override: false });

// docker --env-file keeps quotes literally; strip one layer like db/index.ts.
// Not required here: `drizzle-kit generate` works without a database.
const url = (process.env.DATABASE_URL ?? "").trim().replace(/^(["'])(.*)\1$/, "$2");

export default defineConfig({
    schema: "./db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: { url },
});
