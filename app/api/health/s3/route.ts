import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { describeS3Config } from "@/lib/providers/s3-health";
import { probeS3Access } from "@/lib/s3-upload";

/**
 * Says which piece of the S3 configuration is missing: OIDC token, assumable
 * role, or bucket access. Never returns a secret. `?probe=1` additionally tries
 * a HeadBucket with the resolved identity.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const health = describeS3Config(process.env);
  const wantsProbe = new URL(request.url).searchParams.get("probe") === "1";
  if (!wantsProbe) {
    return NextResponse.json(health);
  }

  try {
    const probe = await probeS3Access();
    return NextResponse.json({ ...health, probe });
  } catch (error) {
    return NextResponse.json({
      ...health,
      probe: {
        ok: false,
        error: (
          error instanceof Error ? error.message : "configuration incomplete"
        ).slice(0, 200),
      },
    });
  }
}
