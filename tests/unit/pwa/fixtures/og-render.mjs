// Renders a JSON-serialised element tree with the real next/og engine
// (@vercel/og is ESM-only, which Jest's CommonJS runtime cannot import).
// stdin: { element, width, height } → stdout: PNG bytes.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const React = require("react");
const { ImageResponse } = await import(
  require.resolve("next/dist/compiled/@vercel/og/index.node.js")
);

const { element, width, height } = JSON.parse(readFileSync(0, "utf8"));

function build(node) {
  if (!node || typeof node !== "object" || !node.type) return node;
  const { children, ...props } = node.props ?? {};
  if (props.style) {
    for (const [key, value] of Object.entries(props.style)) {
      if (value === "__undefined__") props.style[key] = undefined;
    }
  }
  const kids = [].concat(children ?? []).filter((c) => c != null && c !== false).map(build);
  return React.createElement(node.type, props, ...kids);
}

const response = new ImageResponse(build(element), { width, height });
process.stdout.write(Buffer.from(await response.arrayBuffer()));
