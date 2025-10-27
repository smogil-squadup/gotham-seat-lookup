import { NextRequest, NextResponse } from "next/server";
import { searchPaymentsByNameOrEmail } from "@/lib/db";

const HOST_USER_ID = 9987142;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchQuery } = body;

    console.log('Seat lookup request:', { searchQuery, hostUserId: HOST_USER_ID });

    // Validate input
    if (!searchQuery || typeof searchQuery !== "string") {
      return NextResponse.json(
        {
          error: "Search query is required",
        },
        { status: 400 }
      );
    }

    // Query the database for payments matching the search query for host user 9987142
    console.log('Executing database query...');
    const results = await searchPaymentsByNameOrEmail({
      searchQuery: searchQuery.trim(),
      hostUserId: HOST_USER_ID,
    });

    console.log('Query successful, found results:', results.length);

    return NextResponse.json({
      results,
      metadata: {
        hostUserId: HOST_USER_ID,
        searchQuery: searchQuery.trim(),
        total: results.length,
      },
    });
  } catch (error) {
    console.error("Seat lookup error details:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');

    // Check if it's a connection error
    if (error instanceof Error && error.message.includes("connect")) {
      return NextResponse.json(
        {
          error:
            "Database connection failed. Please check your credentials and try again.",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to search for seats",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : "Unknown error"
            : undefined,
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing connection
export async function GET() {
  try {
    const { query } = await import("@/lib/db");

    // Simple test query
    const result = await query(
      "SELECT NOW() as current_time, current_database() as database"
    );

    const firstRow = result[0] as { database: string; current_time: string };

    return NextResponse.json({
      status: "connected",
      database: firstRow.database,
      serverTime: firstRow.current_time,
      hostUserId: HOST_USER_ID,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: "Database connection failed",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : "Unknown error"
            : undefined,
      },
      { status: 503 }
    );
  }
}
