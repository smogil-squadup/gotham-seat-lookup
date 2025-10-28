"use client";

import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Download,
  Loader2,
  Search,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  const [eventDate, setEventDate] = useState<Date | undefined>(undefined);
  const [showPastTransactions, setShowPastTransactions] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a name or email to search");
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
      toast.error(
        error instanceof Error ? error.message : "Search failed"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    // Apply same filters as display
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filteredResults = results;

    // Filter by selected event date
    if (eventDate) {
      const selectedDateStr = format(eventDate, "MM/dd/yyyy");
      filteredResults = filteredResults.filter(
        (r) => r.eventStartDate === selectedDateStr
      );
    }

    // Filter past transactions
    if (!showPastTransactions) {
      filteredResults = filteredResults.filter((r) => {
        const eventDateParts = r.eventStartDate.split("/");
        const eventDateObj = new Date(
          parseInt(eventDateParts[2]),
          parseInt(eventDateParts[0]) - 1,
          parseInt(eventDateParts[1])
        );
        eventDateObj.setHours(0, 0, 0, 0);
        return eventDateObj >= today;
      });
    }

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

      <h1 className="text-3xl font-bold mb-4">Gotham Seat Lookup</h1>
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
              <label className="block text-sm font-medium mb-2">
                Name or Email
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 p-3 border rounded-md"
                  placeholder="Enter name or email address..."
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
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
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
                Search for payments associated with host user ID 9987142
              </p>
            </div>

            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">
                  Filter by Event Date (Optional)
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={`w-full p-3 border rounded-md text-left flex items-center gap-2 ${
                        !eventDate ? "text-gray-500" : ""
                      }`}
                      disabled={isLoading}
                    >
                      <CalendarIcon size={20} />
                      {eventDate ? format(eventDate, "PPP") : "Select a date"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={eventDate}
                      onSelect={setEventDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {eventDate && (
                <button
                  onClick={() => setEventDate(undefined)}
                  className="px-4 py-3 border rounded-md hover:bg-gray-50 transition-colors"
                  disabled={isLoading}
                >
                  Clear Date
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showPastTransactions"
                checked={showPastTransactions}
                onChange={(e) => setShowPastTransactions(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label
                htmlFor="showPastTransactions"
                className="text-sm font-medium cursor-pointer"
              >
                Show past transactions
              </label>
            </div>
          </div>
        </div>

        {results.length > 0 && (() => {
          // Filter results based on date and past transactions settings
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let filteredResults = results;

          // Filter by selected event date
          if (eventDate) {
            const selectedDateStr = format(eventDate, "MM/dd/yyyy");
            filteredResults = filteredResults.filter(
              (r) => r.eventStartDate === selectedDateStr
            );
          }

          // Filter past transactions
          if (!showPastTransactions) {
            filteredResults = filteredResults.filter((r) => {
              const eventDateParts = r.eventStartDate.split("/");
              const eventDateObj = new Date(
                parseInt(eventDateParts[2]),
                parseInt(eventDateParts[0]) - 1,
                parseInt(eventDateParts[1])
              );
              eventDateObj.setHours(0, 0, 0, 0);
              return eventDateObj >= today;
            });
          }

          return (
            <div className="bg-white border rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  Results ({filteredResults.length})
                </h2>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <Download size={20} />
                Export CSV
              </button>
            </div>

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
                      <td className="p-2 font-mono">{result.paymentId}</td>
                      <td className="p-2">{result.eventName}</td>
                      <td className="p-2">{result.eventStartDate}</td>
                      <td className="p-2">{result.eventStartTime}</td>
                      <td className="p-2">{result.payerName || "-"}</td>
                      <td className="p-2">{result.seatInfo || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          );
        })()}
      </div>
    </main>
  );
}
