import { HeadBucketCommand, S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { AssumeRoleWithWebIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import {
  bucketFromResourceArn,
  createOidcCredentialProvider,
  type AwsCredentials,
} from "./providers/s3-credentials";

const DEFAULT_REGION = "eu-west-3";

export type S3Config = {
  bucket: string;
  region: string;
};

/**
 * Two ways in: static keys (local development, CI) or the AWS role the Vercel
 * deployment assumes through OIDC, where nothing secret is stored.
 */
export function getS3Config(): S3Config {
  const bucket =
    process.env.S3_UPLOAD_BUCKET ||
    bucketFromResourceArn(process.env.BILDSTRIP_AWS_RESOURCE_ARN ?? "") ||
    "";
  const region =
    process.env.S3_UPLOAD_REGION || process.env.BILDSTRIP_AWS_REGION || DEFAULT_REGION;

  if (!bucket) {
    throw new Error(
      "Missing S3 bucket: set S3_UPLOAD_BUCKET or BILDSTRIP_AWS_RESOURCE_ARN",
    );
  }
  return { bucket, region };
}

function buildCredentials(): AwsCredentials | (() => Promise<AwsCredentials>) {
  const key = process.env.S3_UPLOAD_KEY;
  const secret = process.env.S3_UPLOAD_SECRET;
  if (key && secret) {
    return { accessKeyId: key, secretAccessKey: secret };
  }

  const roleArn = process.env.BILDSTRIP_AWS_ROLE_ARN;
  if (!roleArn) {
    throw new Error(
      "Missing AWS credentials: set S3_UPLOAD_KEY/SECRET or BILDSTRIP_AWS_ROLE_ARN",
    );
  }

  const sts = new STSClient({
    region: process.env.BILDSTRIP_AWS_REGION || DEFAULT_REGION,
  });

  return createOidcCredentialProvider({
    roleArn,
    sessionName: "bildstrip",
    getToken: async () => {
      const token = process.env.VERCEL_OIDC_TOKEN;
      if (!token) throw new Error("VERCEL_OIDC_TOKEN is not available");
      return token;
    },
    assumeRole: async ({ roleArn: role, token, sessionName }) => {
      const response = await sts.send(
        new AssumeRoleWithWebIdentityCommand({
          RoleArn: role,
          WebIdentityToken: token,
          RoleSessionName: sessionName,
        }),
      );
      const credentials = response.Credentials;
      if (!credentials?.AccessKeyId || !credentials.SecretAccessKey) {
        throw new Error("AssumeRoleWithWebIdentity returned no credentials");
      }
      return {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
        expiration: credentials.Expiration,
      };
    },
  });
}

let client: S3Client | null = null;
function s3Client(config: S3Config): S3Client {
  client ??= new S3Client({
    region: config.region,
    // The SDK accepts a provider function and re-invokes it when credentials
    // near expiry, so a long-running function keeps working.
    credentials: buildCredentials() as never,
  });
  return client;
}

export async function uploadImageToS3(imageUrl: string, key: string): Promise<string> {
  const config = getS3Config();

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());

    await s3Client(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: `comics/${key}`,
        Body: imageBuffer,
        ContentType: "image/jpeg",
        Metadata: {
          "app-name": "make-comics",
          type: "comic-page",
        },
      }),
    );

    return `https://${config.bucket}.s3.${config.region}.amazonaws.com/comics/${key}`;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw new Error("Failed to upload image to S3");
  }
}

/** Diagnostic only: proves the resolved identity can see the bucket. */
export async function probeS3Access(): Promise<{ ok: boolean; error?: string }> {
  const config = getS3Config();
  try {
    await s3Client(config).send(new HeadBucketCommand({ Bucket: config.bucket }));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: (error instanceof Error ? error.message : "unknown error").slice(0, 200),
    };
  }
}
