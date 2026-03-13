"use strict";

const fs = require("fs");
const path = require("path");

const content = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExeca = getExeca;
/**
 * Load execa via dynamic import so the package works when compiled to CommonJS.
 * execa@8 is ESM-only; require("execa") throws ERR_REQUIRE_ESM on some Node versions.
 */
let cached = null;
async function getExeca() {
    if (!cached) {
        const m = await import("execa");
        cached = m.execa;
    }
    return cached;
}
`;

const outPath = path.join(__dirname, "..", "dist", "execaLoader.js");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, content, "utf8");
