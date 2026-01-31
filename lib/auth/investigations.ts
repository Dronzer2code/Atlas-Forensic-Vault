"use server";

import { getServerSession } from "next-auth";
import { authOptions, clientPromise } from "@/lib/auth/config";
import { ObjectId } from "mongodb";

const MONTHLY_INVESTIGATION_LIMIT = 2;

export interface Investigation {
  id: string;
  repoUrl: string;
  repoName: string;
  timestamp: Date;
  podcastId: string;
}

export interface InvestigationStatus {
  isAllowed: boolean;
  remaining: number;
  total: number;
  currentMonth: string;
  investigations: Investigation[];
  message?: string;
}

/**
 * Get the start of the current calendar month in UTC
 */
function getMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Get a formatted month string (e.g., "January 2026")
 */
function getMonthString(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Check the user's investigation status for the current month
 */
export async function checkInvestigationLimit(): Promise<InvestigationStatus> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      isAllowed: false,
      remaining: 0,
      total: MONTHLY_INVESTIGATION_LIMIT,
      currentMonth: getMonthString(),
      investigations: [],
      message: "Authentication required. Please log in to proceed.",
    };
  }

  const client = await clientPromise;
  const db = client.db(process.env.DB_NAME || "repo-podcast");
  const usersCollection = db.collection("users");

  const user = await usersCollection.findOne({
    _id: new ObjectId(session.user.id),
  });

  if (!user) {
    return {
      isAllowed: false,
      remaining: 0,
      total: MONTHLY_INVESTIGATION_LIMIT,
      currentMonth: getMonthString(),
      investigations: [],
      message: "User record not found in the Vault.",
    };
  }

  const monthStart = getMonthStart();
  const investigations: Investigation[] = user.investigations || [];

  // Count investigations this month
  const thisMonthInvestigations = investigations.filter(
    (inv: Investigation) => new Date(inv.timestamp) >= monthStart
  );

  const count = thisMonthInvestigations.length;
  const remaining = Math.max(0, MONTHLY_INVESTIGATION_LIMIT - count);

  return {
    isAllowed: count < MONTHLY_INVESTIGATION_LIMIT,
    remaining,
    total: MONTHLY_INVESTIGATION_LIMIT,
    currentMonth: getMonthString(),
    investigations: thisMonthInvestigations,
    message:
      remaining === 0
        ? "RED NOTICE: Monthly investigation limit reached."
        : undefined,
  };
}

/**
 * Record a new investigation for the current user
 */
export async function recordInvestigation(
  repoUrl: string,
  repoName: string,
  podcastId: string
): Promise<{ success: boolean; error?: string; status: InvestigationStatus }> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      success: false,
      error: "Authentication required",
      status: {
        isAllowed: false,
        remaining: 0,
        total: MONTHLY_INVESTIGATION_LIMIT,
        currentMonth: getMonthString(),
        investigations: [],
      },
    };
  }

  // First check if the limit is already reached
  const currentStatus = await checkInvestigationLimit();
  if (!currentStatus.isAllowed) {
    return {
      success: false,
      error: "Monthly investigation limit reached",
      status: currentStatus,
    };
  }

  const client = await clientPromise;
  const db = client.db(process.env.DB_NAME || "repo-podcast");

  const investigation: Investigation = {
    id: crypto.randomUUID(),
    repoUrl,
    repoName,
    timestamp: new Date(),
    podcastId,
  };

  // Push the new investigation to the user's array
  // Using db.command for proper typing with $push on embedded arrays
  await db.command({
    update: "users",
    updates: [
      {
        q: { _id: new ObjectId(session.user.id) },
        u: {
          $push: { investigations: investigation },
          $set: { updatedAt: new Date() },
        },
      },
    ],
  });

  // Return updated status
  const updatedStatus = await checkInvestigationLimit();
  return {
    success: true,
    status: updatedStatus,
  };
}

/**
 * Get investigation history for the current user (all time)
 */
export async function getInvestigationHistory(): Promise<Investigation[]> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return [];
  }

  const client = await clientPromise;
  const db = client.db(process.env.DB_NAME || "repo-podcast");
  const usersCollection = db.collection("users");

  const user = await usersCollection.findOne({
    _id: new ObjectId(session.user.id),
  });

  return user?.investigations || [];
}

/**
 * Server-side validation before starting an investigation
 * This is the critical check that prevents bypassing
 */
export async function validateInvestigationAccess(
  repoUrl: string
): Promise<{
  allowed: boolean;
  status: InvestigationStatus;
  redirectUrl?: string;
}> {
  const session = await getServerSession(authOptions);

  // Not authenticated - require login
  if (!session?.user) {
    const callbackUrl = encodeURIComponent(`/?repo=${encodeURIComponent(repoUrl)}`);
    return {
      allowed: false,
      status: {
        isAllowed: false,
        remaining: 0,
        total: MONTHLY_INVESTIGATION_LIMIT,
        currentMonth: getMonthString(),
        investigations: [],
        message: "Authentication required",
      },
      redirectUrl: `/login?callbackUrl=${callbackUrl}`,
    };
  }

  // Check investigation limit
  const status = await checkInvestigationLimit();

  return {
    allowed: status.isAllowed,
    status,
  };
}
