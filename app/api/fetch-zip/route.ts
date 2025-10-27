import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { transactionIds } = await request.json();

    if (!transactionIds || !Array.isArray(transactionIds)) {
      return NextResponse.json(
        { error: "Transaction IDs must be provided as an array" },
        { status: 400 }
      );
    }

    const apiKey = process.env.WORLDPAY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const results = [];
    const errors = [];

    for (const txnId of transactionIds) {
      try {
        const response = await fetch(
          `https://test-api.payrix.com/txns/${txnId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              APIKEY: apiKey,
            },
          }
        );

        if (!response.ok) {
          errors.push({
            transactionId: txnId,
            error: `HTTP ${response.status}: ${response.statusText}`,
          });
          continue;
        }

        const data = await response.json();

        // Extract ZIP from the nested response structure
        const zipCode = data?.response?.data?.[0]?.zip || "Not found";

        results.push({
          transactionId: txnId,
          zipCode,
          fullResponse: data, // Include full response for debugging
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        errors.push({
          transactionId: txnId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      results,
      errors,
      summary: {
        total: transactionIds.length,
        successful: results.length,
        failed: errors.length,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
