import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Real environment variables win over .env (dotenv never overrides them).
dotenv.config({ path: ".env", quiet: true });

// docker --env-file keeps quotes literally; strip one layer like db/index.ts.
// Not required here: `drizzle-kit generate` works without a database.
const url = (process.env.DATABASE_URL ?? "").trim().replace(/^(["'])(.*)\1$/, "$2");

export default defineConfig({
    schema: "./db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: { url },
});
