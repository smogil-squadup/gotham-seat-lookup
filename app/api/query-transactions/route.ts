import { NextRequest, NextResponse } from "next/server";
import { searchPayments } from "@/lib/db";

// Helper function to fetch ZIP code from Worldpay API
async function fetchZipFromWorldpay(
  transactionId: string | null
): Promise<string> {
  // Handle null or invalid transaction IDs
  if (!transactionId) {
    return "No transaction ID";
  }

  // Only process transaction IDs that look like Worldpay format (t1_txn_...)
  if (!transactionId.startsWith("t1_txn_")) {
    return "Invalid transaction format";
  }

  try {
    const apiKey = process.env.WORLDPAY_API_KEY;
    if (!apiKey) {
      return "API key not configured";
    }

    const response = await fetch(
      `https://test-api.payrix.com/txns/${transactionId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          APIKEY: apiKey,
        },
      }
    );

    if (!response.ok) {
      return `API error: ${response.status}`;
    }

    const data = await response.json();
    return data?.response?.data?.[0]?.zip || "ZIP not found";
  } catch (error) {
    return `API error: ${error instanceof Error ? error.message : "Unknown"}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      transactionIds,
      dateFrom,
      dateTo,
      hostUserId,
      limit = 100,
      offset = 0,
    } = body;

    // Validate input - host user ID is now required
    if (!hostUserId) {
      return NextResponse.json(
        {
          error: "Host user ID is required",
        },
        { status: 400 }
      );
    }

    // Query the database
    const payments = await searchPayments({
      transactionIds: transactionIds
        ? Array.isArray(transactionIds)
          ? transactionIds
          : [transactionIds]
        : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      hostUserId: hostUserId ? parseInt(hostUserId) : undefined,
      limit: Math.min(limit, 1000), // Cap at 1000 for safety
      offset,
    });

    // Fetch ZIP codes from Worldpay API for each transaction
    const results = [];
    const errors = [];

    for (const payment of payments) {
      try {
        const zipCode = await fetchZipFromWorldpay(payment.transaction_id);

        results.push({
          transactionId: payment.transaction_id,
          zipCode,
          createdAt: payment.created_at,
          amount: payment.amount ? Number(payment.amount) : null,
          status: payment.status,
          cardType: payment.card_type,
          lastFour: payment.last_four,
          ipAddress: payment.metadata?.ip_address,
          // Database-specific fields
          paymentId: payment.id,
          userId: payment.user_id,
          eventId: payment.event_id,
          eventAttendeeId: payment.event_attendee_id,
        });

        // Add a small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        errors.push({
          transactionId: payment.transaction_id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      results,
      errors,
      summary: {
        total: payments.length,
        successful: results.length,
        failed: errors.length,
      },
      metadata: {
        source: "database + api",
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Database query error:", error);

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
        error: "Failed to query transactions",
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
      readOnly: true,
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
