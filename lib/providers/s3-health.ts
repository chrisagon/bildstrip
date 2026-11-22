import { bucketFromResourceArn } from "./s3-credentials.ts";

export type S3AuthMode = "static-keys" | "oidc-role" | "none";

export type S3Health = {
  authMode: S3AuthMode;
  bucket: string | null;
  region: string | null;
  tokenPresent: boolean;
  roleArnPresent: boolean;
};

type Env = Record<string, string | undefined>;

/**
 * Describes what is configured, without ever reading or returning a secret.
 * Used by `/api/health/s3` to say which of the three pieces is missing.
 */
export function describeS3Config(env: Env): S3Health {
  const hasStaticKeys = Boolean(env.S3_UPLOAD_KEY && env.S3_UPLOAD_SECRET);
  const roleArnPresent = Boolean(env.BILDSTRIP_AWS_ROLE_ARN);

  const authMode: S3AuthMode = hasStaticKeys
    ? "static-keys"
    : roleArnPresent
      ? "oidc-role"
      : "none";

  const bucket =
    env.S3_UPLOAD_BUCKET ??
    bucketFromResourceArn(env.BILDSTRIP_AWS_RESOURCE_ARN ?? "") ??
    null;

  return {
    authMode,
    bucket,
    // Report the region the uploader will actually use, default included.
    region: env.S3_UPLOAD_REGION ?? env.BILDSTRIP_AWS_REGION ?? "eu-west-3",
    tokenPresent: Boolean(env.VERCEL_OIDC_TOKEN),
    roleArnPresent,
  };
}
