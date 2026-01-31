import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import {
  checkInvestigationLimit,
  getInvestigationHistory,
} from "@/lib/auth/investigations";

export const runtime = "nodejs";

/**
 * GET /api/auth/investigation-status
 * Returns the current user's investigation limit status
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          error: "Authentication required",
          authenticated: false,
        },
        { status: 401 }
      );
    }

    const status = await checkInvestigationLimit();
    const history = await getInvestigationHistory();

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        badgeId: session.user.badgeId,
      },
      status,
      history,
    });
  } catch (error: any) {
    console.error("Error checking investigation status:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
