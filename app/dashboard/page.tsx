"use client";

import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Loader2, Search } from "lucide-react";

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
              <div className="flex flex-col sm:flex-row gap-2">
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
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap">
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
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
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
              <div className="bg-white border rounded-lg p-4 sm:p-6 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">
                    Results ({filteredResults.length})
                  </h2>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredResults.map((result, idx) => (
                      <div
                        key={idx}
                        className="border rounded-lg p-4 hover:bg-gray-50 hover:shadow-md transition-all">
                        {/* Seat Info - Most Prominent */}
                        <div className="mb-3 pb-3 border-b">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Seat
                          </div>
                          <div className="text-xl font-bold text-blue-600 whitespace-pre-line">
                            {result.seatInfo || "-"}
                          </div>
                        </div>

                        {/* Other Details */}
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="font-medium text-gray-600">
                              Attendee:
                            </span>
                            <span className="font-semibold text-right">
                              {result.payerName || "-"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="font-medium text-gray-600">
                              Event:
                            </span>
                            <span className="text-right">{result.eventName}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="font-medium text-gray-600">
                              Date:
                            </span>
                            <span className="text-right">
                              {result.eventStartDate} {result.eventStartTime}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="font-medium text-gray-600">
                              Payment ID:
                            </span>
                            <span className="font-mono text-xs text-right">
                              {result.paymentId}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
      </div>
    </main>
  );
}
