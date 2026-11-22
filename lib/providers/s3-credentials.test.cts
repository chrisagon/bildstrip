const assert = require("node:assert/strict");
const test = require("node:test");

const {
  bucketFromResourceArn,
  needsRefresh,
  createOidcCredentialProvider,
} = require("./s3-credentials.ts");

test("derives the bucket name from an S3 resource ARN", () => {
  assert.equal(bucketFromResourceArn("arn:aws:s3:::bildstrip-media"), "bildstrip-media");
  assert.equal(
    bucketFromResourceArn("arn:aws:s3:::bildstrip-media/comics/*"),
    "bildstrip-media",
  );
  assert.equal(bucketFromResourceArn("pas un arn"), null);
});

test("refreshes credentials shortly before they expire", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  assert.equal(needsRefresh(undefined, now), true);
  assert.equal(needsRefresh(new Date("2026-01-01T12:04:00Z"), now), true);
  assert.equal(needsRefresh(new Date("2026-01-01T13:00:00Z"), now), false);
});

test("credentials are assumed once and reused until they near expiry", async () => {
  let calls = 0;
  const provider = createOidcCredentialProvider({
    roleArn: "arn:aws:iam::123456789012:role/bildstrip",
    sessionName: "bildstrip",
    getToken: async () => "oidc-token",
    assumeRole: async (input: { roleArn: string; token: string; sessionName: string }) => {
      calls++;
      assert.equal(input.token, "oidc-token");
      return {
        accessKeyId: "ASIAEXAMPLE",
        secretAccessKey: "secret",
        sessionToken: "session",
        expiration: new Date("2026-01-01T13:00:00Z"),
      };
    },
    now: () => new Date("2026-01-01T12:00:00Z"),
  });

  const first = await provider();
  const second = await provider();

  assert.equal(calls, 1);
  assert.equal(first.accessKeyId, "ASIAEXAMPLE");
  assert.equal(second.sessionToken, "session");
});
