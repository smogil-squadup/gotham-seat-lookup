import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  let sqlQuery: string | undefined;
  
  try {
    const body = await request.json();
    sqlQuery = body.sqlQuery;

    // Validate input
    if (!sqlQuery || typeof sqlQuery !== 'string') {
      return NextResponse.json(
        {
          error: "SQL query is required",
        },
        { status: 400 }
      );
    }

    // Basic security check - prevent dangerous operations
    const normalizedQuery = sqlQuery.toLowerCase().trim();
    const dangerousPatterns = [
      /\bdrop\b/, /\bdelete\b/, /\btruncate\b/, /\binsert\b/, /\bupdate\b/, 
      /\bcreate\b/, /\balter\b/, /\bgrant\b/, /\brevoke\b/, /\bexec\b/, /\bexecute\b/
    ];
    
    for (const pattern of dangerousPatterns) {
      const match = normalizedQuery.match(pattern);
      if (match) {
        return NextResponse.json(
          {
            error: `SQL query contains potentially dangerous keyword: ${match[0]}. Only SELECT queries are allowed.`,
          },
          { status: 400 }
        );
      }
    }

    // Ensure query starts with SELECT
    if (!normalizedQuery.startsWith('select')) {
      return NextResponse.json(
        {
          error: "Only SELECT queries are allowed",
        },
        { status: 400 }
      );
    }

    // Handle table name corrections for warehouse cluster
    let modifiedQuery = sqlQuery;
    
    // Auto-correct table names to use FDW suffix
    if (!normalizedQuery.includes('_fdw')) {
      // Replace common table names with FDW versions
      modifiedQuery = modifiedQuery
        .replace(/\bFROM\s+payments\b/gi, 'FROM payments_fdw')
        .replace(/\bJOIN\s+payments\b/gi, 'JOIN payments_fdw')
        .replace(/\bFROM\s+events\b/gi, 'FROM events_fdw')
        .replace(/\bJOIN\s+events\b/gi, 'JOIN events_fdw')
        .replace(/\bFROM\s+users\b/gi, 'FROM users_fdw')
        .replace(/\bJOIN\s+users\b/gi, 'JOIN users_fdw');
      
      if (modifiedQuery !== sqlQuery) {
        console.log('Auto-corrected table names to use FDW suffix');
      }
    }
    
    // Handle SELECT * queries on FDW tables by replacing with explicit columns
    if (normalizedQuery.includes('select *') && modifiedQuery.toLowerCase().includes('_fdw')) {
      // Replace SELECT * with explicit column list for payments_fdw
      if (modifiedQuery.toLowerCase().includes('payments_fdw')) {
        modifiedQuery = modifiedQuery.replace(/SELECT\s+\*/i, 
          'SELECT id, transaction_id, status, name_on_card, card_type, last_four, ' +
          'amount, created_at, user_id, event_id, event_attendee_id, shipping_address_id, ' +
          'metadata, payment_gateway_id, refund_amount, phone_number'
        );
        console.log('Modified query to use explicit columns');
      }
    }

    // Execute the query
    const startTime = Date.now();
    const results = await query(modifiedQuery);
    const executionTime = Date.now() - startTime;

    return NextResponse.json({
      results,
      metadata: {
        source: "custom_sql",
        rowCount: results.length,
        executionTime: `${executionTime}ms`,
        query: modifiedQuery,
        originalQuery: modifiedQuery !== sqlQuery ? sqlQuery : undefined,
        queryModified: modifiedQuery !== sqlQuery,
        modification: modifiedQuery !== sqlQuery ? "Table names auto-corrected to use FDW suffix (warehouse cluster requirement)" : undefined
      },
    });
  } catch (error) {
    console.error("SQL execution error:", error);
    console.error("Failed query:", sqlQuery);

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

    // Log the specific error for debugging
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorCode = (error as {code?: string}).code || "UNKNOWN";
    console.error("Error details:", errorMessage);
    console.error("Error code:", errorCode);
    
    // Check for permission errors
    if (errorMessage.includes("permission denied")) {
      return NextResponse.json(
        {
          error: "Permission denied for the requested table. The warehouse cluster may require different table names.",
          details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
          hint: "Try using table names with '_fdw' suffix (e.g., payments_fdw instead of payments)"
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to execute SQL query",
        details:
          process.env.NODE_ENV === "development"
            ? errorMessage
            : undefined,
        query: process.env.NODE_ENV === "development" ? sqlQuery : undefined,
        code: process.env.NODE_ENV === "development" ? errorCode : undefined,
      },
      { status: 500 }
    );
  }
}