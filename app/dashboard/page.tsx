"use client";

import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Download, Loader2, Search } from "lucide-react";
import { format } from "date-fns";

interface SeatLookupResult {
  eventName: string;
  eventStartDate: string;
  eventStartTime: string;
  paymentId: number;
  amount: number;
  payerName?: string;
  payerEmail?: string;
  seatInfo?: string;
  transactionId?: string;
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SeatLookupResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPastTransactions, setShowPastTransactions] = useState(false);
  const [showFutureTransactions, setShowFutureTransactions] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a name to search");
      return;
    }

    setIsLoading(true);
    setResults([]);

    toast.loading("Searching for seats...", { id: "search" });

    try {
      const response = await fetch("/api/seat-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchQuery: searchQuery.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResults(data.results || []);

      toast.dismiss("search");
      toast.success(`Found ${data.results?.length || 0} result(s)`);
    } catch (error) {
      toast.dismiss("search");
      toast.error(error instanceof Error ? error.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    // Apply same filters as display
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filteredResults = results.filter((r) => {
      const eventDateParts = r.eventStartDate.split("/");
      const eventDateObj = new Date(
        parseInt(eventDateParts[2]),
        parseInt(eventDateParts[0]) - 1,
        parseInt(eventDateParts[1])
      );
      eventDateObj.setHours(0, 0, 0, 0);

      const isToday = eventDateObj.getTime() === today.getTime();
      const isPast = eventDateObj < today;
      const isFuture = eventDateObj > today;

      // Always include today
      if (isToday) return true;

      // Include past if checkbox is checked
      if (isPast && showPastTransactions) return true;

      // Include future if checkbox is checked
      if (isFuture && showFutureTransactions) return true;

      return false;
    });

    const headers = [
      "Event Name",
      "Event Date",
      "Event Time",
      "Payment ID",
      "Payer Name",
      "Seat",
    ];

    const rows = filteredResults.map((r) => [
      r.eventName,
      r.eventStartDate,
      r.eventStartTime,
      r.paymentId,
      r.payerName || "",
      r.seatInfo || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seat-lookup-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("CSV exported successfully");
  };

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <Toaster position="top-right" />

      <h1 className="text-3xl font-bold mb-4">Seat Lookup</h1>
      <p className="text-gray-600 mb-8">
        Search for attendees by name or email
      </p>

      <div className="space-y-6">
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Search</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 p-3 border rounded-md"
                  placeholder="Enter attendee name..."
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={isLoading || !searchQuery.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search size={20} />
                      Search
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Search by attendee name (first, last, or full name)
              </p>
            </div>

            {results.length > 0 &&
              (() => {
                // Calculate counts for checkboxes
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                let pastCount = 0;
                let futureCount = 0;

                results.forEach((r) => {
                  const eventDateParts = r.eventStartDate.split("/");
                  const eventDateObj = new Date(
                    parseInt(eventDateParts[2]),
                    parseInt(eventDateParts[0]) - 1,
                    parseInt(eventDateParts[1])
                  );
                  eventDateObj.setHours(0, 0, 0, 0);

                  if (eventDateObj < today) {
                    pastCount++;
                  } else if (eventDateObj > today) {
                    futureCount++;
                  }
                });

                return (
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="showPastTransactions"
                        checked={showPastTransactions}
                        onChange={(e) =>
                          setShowPastTransactions(e.target.checked)
                        }
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <label
                        htmlFor="showPastTransactions"
                        className="text-sm font-medium cursor-pointer">
                        Show past transactions ({pastCount})
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="showFutureTransactions"
                        checked={showFutureTransactions}
                        onChange={(e) =>
                          setShowFutureTransactions(e.target.checked)
                        }
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <label
                        htmlFor="showFutureTransactions"
                        className="text-sm font-medium cursor-pointer">
                        Show future transactions ({futureCount})
                      </label>
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>

        {results.length > 0 &&
          (() => {
            // Filter results: always show today, optionally show past/future based on checkboxes
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Categorize all results
            let todayCount = 0;
            let pastCount = 0;
            let futureCount = 0;

            results.forEach((r) => {
              const eventDateParts = r.eventStartDate.split("/");
              const eventDateObj = new Date(
                parseInt(eventDateParts[2]),
                parseInt(eventDateParts[0]) - 1,
                parseInt(eventDateParts[1])
              );
              eventDateObj.setHours(0, 0, 0, 0);

              if (eventDateObj.getTime() === today.getTime()) {
                todayCount++;
              } else if (eventDateObj < today) {
                pastCount++;
              } else if (eventDateObj > today) {
                futureCount++;
              }
            });

            const filteredResults = results.filter((r) => {
              const eventDateParts = r.eventStartDate.split("/");
              const eventDateObj = new Date(
                parseInt(eventDateParts[2]),
                parseInt(eventDateParts[0]) - 1,
                parseInt(eventDateParts[1])
              );
              eventDateObj.setHours(0, 0, 0, 0);

              const isToday = eventDateObj.getTime() === today.getTime();
              const isPast = eventDateObj < today;
              const isFuture = eventDateObj > today;

              // Always show today
              if (isToday) return true;

              // Show past if checkbox is checked
              if (isPast && showPastTransactions) return true;

              // Show future if checkbox is checked
              if (isFuture && showFutureTransactions) return true;

              return false;
            });

            return (
              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">
                    Results ({filteredResults.length})
                  </h2>
                  <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                    <Download size={20} />
                    Export CSV
                  </button>
                </div>

                {filteredResults.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600 mb-4">
                      No transactions found for today.
                    </p>
                    {(pastCount > 0 || futureCount > 0) && (
                      <p className="text-sm text-gray-500">
                        {pastCount > 0 && futureCount > 0
                          ? `Found ${pastCount} past transaction${
                              pastCount !== 1 ? "s" : ""
                            } and ${futureCount} future transaction${
                              futureCount !== 1 ? "s" : ""
                            }. Check the boxes above to view them.`
                          : pastCount > 0
                          ? `Found ${pastCount} past transaction${
                              pastCount !== 1 ? "s" : ""
                            }. Check "Show past transactions" to view.`
                          : `Found ${futureCount} future transaction${
                              futureCount !== 1 ? "s" : ""
                            }. Check "Show future transactions" to view.`}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b">
                          <th className="text-left p-2">Payment ID</th>
                          <th className="text-left p-2">Event Name</th>
                          <th className="text-left p-2">Event Date</th>
                          <th className="text-left p-2">Event Time</th>
                          <th className="text-left p-2">Attendee Name</th>
                          <th className="text-left p-2">Seat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((result, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-mono">
                              {result.paymentId}
                            </td>
                            <td className="p-2">{result.eventName}</td>
                            <td className="p-2">{result.eventStartDate}</td>
                            <td className="p-2">{result.eventStartTime}</td>
                            <td className="p-2">{result.payerName || "-"}</td>
                            <td className="p-2 whitespace-pre-line">
                              {result.seatInfo || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
      </div>
    </main>
  );
}
