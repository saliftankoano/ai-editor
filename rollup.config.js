import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

export default {
  input: "js/agent.mjs",
  output: {
    file: "dist/agent.bundle.js",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    replace({
      preventAssignment: true,
      "process.env.GROQ_API_KEY": JSON.stringify(process.env.GROQ_API_KEY),
      "process.env.GROQ_API_ENDPOINT": JSON.stringify(
        process.env.GROQ_API_ENDPOINT
      ),
      "import.meta.url": JSON.stringify(
        process.env.SITE_URL || "http://localhost:3000"
      ),
    }),
    resolve({
      browser: true,
      preferBuiltins: false,
      // Ignore native modules
      exportConditions: ["browser"],
      // Skip Node.js built-in modules
      skip: [
        "crypto",
        "path",
        "fs",
        "os",
        "stream",
        "events",
        "child_process",
        "http",
        "url",
        "util",
      ],
    }),
    commonjs({
      // Ignore Node.js built-ins
      ignore: [
        "crypto",
        "path",
        "fs",
        "os",
        "stream",
        "events",
        "child_process",
        "http",
        "url",
        "util",
      ],
    }),
    json(),
  ],
  // External modules that shouldn't be bundled
  external: [
    /node:.*/,
    "crypto",
    "path",
    "fs",
    "os",
    "stream",
    "events",
    "child_process",
    "http",
    "url",
    "util",
    /@livekit\/rtc-node.*/,
  ],
};
