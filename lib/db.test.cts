const assert = require("node:assert/strict");
const test = require("node:test");

const { requireDatabaseUrl } = require("./db-config.ts");

test("returns the configured URL", () => {
  assert.equal(
    requireDatabaseUrl({ DATABASE_URL: "postgres://example" }),
    "postgres://example",
  );
});

test("names the missing variable instead of crashing on undefined", () => {
  assert.throws(
    () => requireDatabaseUrl({}),
    /DATABASE_URL environment variable is not set/,
  );
});
