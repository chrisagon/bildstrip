import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBalance } from "@/lib/credits";
import { FREE_WEEKLY_CREDITS } from "@/lib/didactic/quote";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { hasApiKey } = await request.json();

    // Check if user has API key (unlimited)
    if (hasApiKey) {
      return NextResponse.json({
        hasApiKey: true,
        creditsRemaining: "unlimited",
        resetTime: null,
      });
    }

    // Credits replace the old "comics per week" counter: one credit per panel.
    const credits = await getBalance(userId);

    return NextResponse.json({
      hasApiKey: false,
      credits,
      creditsRemaining: credits,
      freeWeeklyCredits: FREE_WEEKLY_CREDITS,
      resetTime: null,
    });
  } catch (error) {
    console.error("Error in check-credits API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
