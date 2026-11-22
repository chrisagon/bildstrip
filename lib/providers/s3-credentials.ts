export type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: Date;
};

const REFRESH_SKEW_MS = 5 * 60 * 1000;

/** `arn:aws:s3:::bucket` and `arn:aws:s3:::bucket/prefix` both name a bucket. */
export function bucketFromResourceArn(arn: string): string | null {
  const match = /^arn:aws[a-z-]*:s3:::([^/]+)/.exec(arn.trim());
  return match?.[1] ?? null;
}

/** True when credentials are missing or expire within the refresh window. */
export function needsRefresh(expiration: Date | undefined, now: Date): boolean {
  if (!expiration) return true;
  return expiration.getTime() - now.getTime() <= REFRESH_SKEW_MS;
}

export type OidcProviderOptions = {
  roleArn: string;
  sessionName: string;
  getToken: () => Promise<string>;
  assumeRole: (input: {
    roleArn: string;
    token: string;
    sessionName: string;
  }) => Promise<AwsCredentials>;
  now?: () => Date;
};

/**
 * Exchanges Vercel's OIDC token for temporary AWS credentials, cached until
 * shortly before expiry. Nothing secret is stored anywhere.
 */
export function createOidcCredentialProvider(
  options: OidcProviderOptions,
): () => Promise<AwsCredentials> {
  const now = options.now ?? (() => new Date());
  let cached: AwsCredentials | null = null;
  let inFlight: Promise<AwsCredentials> | null = null;

  return async function getCredentials(): Promise<AwsCredentials> {
    if (cached && !needsRefresh(cached.expiration, now())) return cached;
    if (inFlight) return inFlight;

    inFlight = (async () => {
      const token = await options.getToken();
      const credentials = await options.assumeRole({
        roleArn: options.roleArn,
        token,
        sessionName: options.sessionName,
      });
      cached = credentials;
      return credentials;
    })();

    try {
      return await inFlight;
    } finally {
      inFlight = null;
    }
  };
}
