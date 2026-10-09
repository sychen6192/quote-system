// Validates every message in messages/<locale>/*.json as ICU MessageFormat
// (e.g. a literal "{SEQ}" must be quoted as "'{SEQ}'"). Jest can't load the
// ESM-only parser, so this runs as part of `npm run lint`.
import fs from "node:fs";
import path from "node:path";
import { IntlMessageFormat } from "intl-messageformat";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "messages");
const problems = [];

for (const locale of fs.readdirSync(root)) {
  const dir = path.join(root, locale);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const walk = (value, key) => {
      if (typeof value === "string") {
        try {
          new IntlMessageFormat(value, locale);
        } catch (error) {
          problems.push(`${locale}/${file} ${key}: ${error.message}`);
        }
      } else if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) walk(v, key ? `${key}.${k}` : k);
      }
    };
    walk(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")), "");
  }
}

if (problems.length) {
  console.error(`Invalid ICU messages:\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("messages: ICU syntax OK");
