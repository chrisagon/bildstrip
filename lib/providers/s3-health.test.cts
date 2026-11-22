const assert = require("node:assert/strict");
const test = require("node:test");

const { describeS3Config } = require("./s3-health.ts");

test("static keys win over the OIDC role", () => {
  const health = describeS3Config({
    S3_UPLOAD_KEY: "AKIAEXAMPLE",
    S3_UPLOAD_SECRET: "secret",
    S3_UPLOAD_BUCKET: "media",
    S3_UPLOAD_REGION: "eu-west-3",
    BILDSTRIP_AWS_ROLE_ARN: "arn:aws:iam::1:role/x",
    VERCEL_OIDC_TOKEN: "token",
  });

  assert.equal(health.authMode, "static-keys");
  assert.equal(health.bucket, "media");
  assert.equal(health.tokenPresent, true);
});

test("falls back to the OIDC role and derives the bucket from the ARN", () => {
  const health = describeS3Config({
    BILDSTRIP_AWS_ROLE_ARN: "arn:aws:iam::1:role/x",
    BILDSTRIP_AWS_RESOURCE_ARN: "arn:aws:s3:::bildstrip-media",
    VERCEL_OIDC_TOKEN: "token",
  });

  assert.equal(health.authMode, "oidc-role");
  assert.equal(health.bucket, "bildstrip-media");
  assert.equal(health.roleArnPresent, true);
  assert.equal(health.region, "eu-west-3");
});

test("reports a missing token instead of pretending OIDC works", () => {
  const health = describeS3Config({
    BILDSTRIP_AWS_ROLE_ARN: "arn:aws:iam::1:role/x",
    BILDSTRIP_AWS_RESOURCE_ARN: "arn:aws:s3:::b",
  });

  assert.equal(health.authMode, "oidc-role");
  assert.equal(health.tokenPresent, false);
});

test("reports the absence of any credential source", () => {
  const health = describeS3Config({});
  assert.equal(health.authMode, "none");
  assert.equal(health.bucket, null);
});
