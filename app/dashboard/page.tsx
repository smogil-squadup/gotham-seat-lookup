"use client";

import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Download,
  Loader2,
  Code,
  Wand2,
  FormInput,
  BarChart3,
  TrendingUp,
  Send,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CHART_PRESETS,
  getChartDataByPreset,
} from "@/lib/chart-utils";

interface Result {
  transactionId: string;
  zipCode: string;
  fullResponse?: Record<string, unknown>;
  createdAt?: string;
  amount?: number;
  status?: string;
  cardType?: string;
  lastFour?: string;
  ipAddress?: string;
  // Database-specific fields
  paymentId?: number;
  userId?: number;
  eventId?: number;
  eventAttendeeId?: number;
}

interface ProcessingError {
  transactionId: string;
  error: string;
}

type DataSource = "sql" | "wizard" | "form";

export default function Home() {
  const [dataSource, setDataSource] = useState<DataSource>("sql");
  const [checkZips, setCheckZips] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [errors, setErrors] = useState<ProcessingError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Chart state
  const [selectedChart, setSelectedChart] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [chartData, setChartData] = useState<Array<Record<string, string | number>>>([]);
  const [chartType, setChartType] = useState<"line" | "bar" | "area" | "pie">("line");
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);
  // SQL query parameters
  const [sqlQuery, setSqlQuery] = useState("");

  // Wizard parameters
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState("");
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [wizardLimit, setWizardLimit] = useState(100);

  // Form parameters
  const [selectedTable, setSelectedTable] = useState("payments_fdw");
  const [sortOption, setSortOption] = useState("created_at_DESC");
  const [formFilters, setFormFilters] = useState({
    limit: 100,
    orderBy: "created_at",
    orderDirection: "DESC",
    status: "",
    cardType: "",
    dateFrom: "",
    dateTo: "",
    minAmount: "",
    maxAmount: "",
    hasGatewayId: false,
    hasTransactionId: false,
    hostUserId: "",
  });


  const processFromSQL = async () => {
    if (!sqlQuery.trim()) {
      toast.error("SQL query is required");
      return;
    }

    setIsProcessing(true);
    setResults([]);
    setErrors([]);
    setProgress(0);

    toast.loading("Executing SQL query...", { id: "processing" });

    try {
      const response = await fetch("/api/execute-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sqlQuery: sqlQuery.trim(),
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError);
        throw new Error(
          "Server returned invalid response. Check the console for details."
        );
      }

      if (!response.ok) {
        throw new Error(data.error || "SQL execution failed");
      }

      toast.dismiss("processing");

      // Show notification if query was auto-corrected
      if (data.metadata?.queryModified) {
        toast.success(
          data.metadata.modification ||
            "Query was automatically modified for compatibility",
          {
            duration: 4000,
          }
        );
      }

      // Execute the generated SQL using the same logic as other tabs
      await processZipCodesFromData(data);
    } catch (error) {
      toast.dismiss("processing");
      toast.error(
        error instanceof Error ? error.message : "SQL execution failed"
      );
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const processFromWizard = async () => {
    if (!naturalLanguageQuery.trim()) {
      toast.error("Natural language query is required");
      return;
    }

    setIsProcessing(true);
    setResults([]);
    setErrors([]);
    setProgress(0);

    toast.loading("Converting to SQL...", { id: "processing" });

    try {
      // First, convert natural language to SQL
      const nlToSqlResponse = await fetch("/api/nl-to-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naturalLanguageQuery: naturalLanguageQuery.trim(),
          limit: wizardLimit,
        }),
      });

      const nlData = await nlToSqlResponse.json();

      if (!nlToSqlResponse.ok) {
        throw new Error(nlData.error || "Failed to convert to SQL");
      }

      setGeneratedSQL(nlData.sql);

      // Show warning if using fallback
      if (nlData.warning) {
        toast.dismiss("processing");
        toast.loading(`${nlData.warning} Executing SQL...`, {
          id: "processing",
          duration: 3000,
        });
      } else {
        toast.dismiss("processing");
        toast.loading("Executing generated SQL...", { id: "processing" });
      }

      // Execute the generated SQL using the same logic as SQL tab
      const data = await executeSQL(nlData.sql);
      await processZipCodesFromData(data);
    } catch (error) {
      toast.dismiss("processing");
      toast.error(
        error instanceof Error ? error.message : "Wizard processing failed"
      );
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const processFromForm = async () => {
    setIsProcessing(true);
    setResults([]);
    setErrors([]);
    setProgress(0);

    toast.loading("Building query...", { id: "processing" });

    try {
      // Generate SQL from form selections
      let sql = "";
      let needsEventsJoin = false;

      if (selectedTable === "payments_with_events") {
        sql = `SELECT p.id, p.transaction_id, p.event_id, p.amount, p.status, p.card_type, p.last_four, p.created_at, p.updated_at, p.user_id, p.payment_gateway_id, e.user_id as host_user_id FROM payments_fdw p LEFT JOIN events_fdw e ON p.event_id = e.id`;
        needsEventsJoin = true;
      } else if (selectedTable === "payments_with_users") {
        sql = `SELECT p.id, p.transaction_id, p.event_id, p.amount, p.status, p.card_type, p.last_four, p.created_at, p.updated_at, p.user_id, p.payment_gateway_id, CONCAT(u.first_name, ' ', u.last_name) as full_name, u.email FROM payments_fdw p LEFT JOIN users_fdw u ON p.user_id = u.id`;
      } else if (selectedTable.includes("payments") && formFilters.hostUserId) {
        // If filtering by host user ID, we need to join with events
        sql = `SELECT p.id, p.transaction_id, p.event_id, p.amount, p.status, p.card_type, p.last_four, p.created_at, p.updated_at, p.user_id, p.payment_gateway_id, e.user_id as host_user_id FROM payments_fdw p LEFT JOIN events_fdw e ON p.event_id = e.id`;
        needsEventsJoin = true;
      } else {
        sql = `SELECT * FROM ${selectedTable}`;
      }

      // Add WHERE conditions based on form filters
      const conditions = [];
      const tablePrefix =
        selectedTable === "payments_with_events" ||
        selectedTable === "payments_with_users" ||
        needsEventsJoin
          ? "p."
          : "";

      if (selectedTable.includes("payments")) {
        if (formFilters.status) {
          conditions.push(`${tablePrefix}status = '${formFilters.status}'`);
        }
        if (formFilters.cardType) {
          conditions.push(
            `${tablePrefix}card_type = '${formFilters.cardType}'`
          );
        }
        if (formFilters.dateFrom) {
          conditions.push(
            `${tablePrefix}created_at >= '${formFilters.dateFrom}'`
          );
        }
        if (formFilters.dateTo) {
          conditions.push(
            `${tablePrefix}created_at <= '${formFilters.dateTo} 23:59:59'`
          );
        }
        if (formFilters.minAmount) {
          conditions.push(`${tablePrefix}amount >= ${formFilters.minAmount}`);
        }
        if (formFilters.maxAmount) {
          conditions.push(`${tablePrefix}amount <= ${formFilters.maxAmount}`);
        }
        if (formFilters.hasGatewayId) {
          conditions.push(`${tablePrefix}payment_gateway_id IS NOT NULL`);
        }
        if (formFilters.hasTransactionId) {
          conditions.push(`${tablePrefix}transaction_id IS NOT NULL`);
        }
        if (formFilters.hostUserId) {
          // This filter requires joining with events to get the host user ID
          conditions.push(`e.user_id = ${parseInt(formFilters.hostUserId)}`);
        }
      }

      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(" AND ")}`;
      }

      sql += ` ORDER BY ${
        selectedTable === "payments_with_events" ||
        selectedTable === "payments_with_users" ||
        needsEventsJoin
          ? "p."
          : ""
      }${formFilters.orderBy} ${formFilters.orderDirection}`;
      sql += ` LIMIT ${formFilters.limit}`;

      toast.dismiss("processing");
      toast.loading("Executing form query...", { id: "processing" });

      // Execute the generated SQL
      const data = await executeSQL(sql);
      await processZipCodesFromData(data);
    } catch (error) {
      toast.dismiss("processing");
      toast.error(
        error instanceof Error ? error.message : "Form processing failed"
      );
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const executeSQL = async (sql: string) => {
    try {
      console.log("Executing SQL:", sql);
      const response = await fetch("/api/execute-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sqlQuery: sql,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("SQL execution failed:", response.status, errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: `HTTP ${response.status}: ${errorText}` };
        }
        throw new Error(
          errorData.error || `SQL execution failed (${response.status})`
        );
      }

      const data = await response.json();
      console.log("SQL execution successful:", data.metadata);

      if (!data.results || !Array.isArray(data.results)) {
        throw new Error("Invalid response format from SQL API");
      }

      return data;
    } catch (error) {
      console.error("executeSQL error:", error);
      throw error;
    }
  };

  const processZipCodesFromData = async (data: {
    results: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
  }) => {
    toast.dismiss("processing");

    if (checkZips) {
      toast.loading("Fetching ZIP codes from Worldpay...", {
        id: "processing",
      });
    }

    // Process data with or without ZIP code lookup
    const results = [];
    const errors = [];

    for (let i = 0; i < data.results.length; i++) {
      const row = data.results[i] as Record<string, unknown>;
      const transactionId = (row.transaction_id ||
        row.id ||
        `row_${i}`) as string;

      setProgress(Math.round((i / data.results.length) * 100));

      let zipCode = "-";

      if (checkZips) {
        try {
          // Fetch ZIP code from API
          const zipResponse = await fetch("/api/fetch-zip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionIds: [transactionId] }),
          });

          const zipData = await zipResponse.json();

          if (zipData.results && zipData.results.length > 0) {
            zipCode = zipData.results[0].zipCode;
          } else if (zipData.errors && zipData.errors.length > 0) {
            errors.push({
              transactionId,
              error: zipData.errors[0].error,
            });
          }

          // Add a small delay to avoid overwhelming the API
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          errors.push({
            transactionId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      results.push({
        transactionId,
        zipCode,
        createdAt: row.created_at as string | undefined,
        amount: row.amount ? Number(row.amount) : undefined,
        status: (row.status as string) || "SUCCESS",
        cardType: row.card_type as string | undefined,
        lastFour: row.last_four as string | undefined,
        paymentId: row.id as number | undefined,
        userId: row.user_id as number | undefined,
        eventId: row.event_id as number | undefined,
        eventAttendeeId: row.event_attendee_id as number | undefined,
        fullResponse: row as Record<string, unknown>,
      });

      // Update results as we go
      setResults([...results]);
      setErrors([...errors]);
    }

    setProgress(100);
    toast.dismiss("processing");
    toast.success(
      `Completed! ${results.length} successful${
        checkZips ? `, ${errors.length} failed` : ""
      }`
    );
    setIsProcessing(false);
  };

  const handleProcess = async () => {
    if (dataSource === "sql") {
      await processFromSQL();
      return;
    }

    if (dataSource === "wizard") {
      await processFromWizard();
      return;
    }

    if (dataSource === "form") {
      await processFromForm();
      return;
    }
  };

  const generateChart = () => {
    if (!selectedChart && !customPrompt.trim()) {
      toast.error("Please select a chart type or enter a custom prompt");
      return;
    }

    if (results.length === 0) {
      toast.error("No data available. Please run a query first.");
      return;
    }

    setIsGeneratingChart(true);

    try {
      if (selectedChart) {
        const preset = CHART_PRESETS.find(p => p.value === selectedChart);
        if (preset) {
          const data = getChartDataByPreset(selectedChart, results);
          setChartData(data);
          setChartType(preset.type);
          toast.success("Chart generated successfully!");
        }
      } else if (customPrompt.trim()) {
        // For custom prompts, we'll use a simple heuristic to determine chart type
        const prompt = customPrompt.toLowerCase();
        
        if (prompt.includes("line") || prompt.includes("trend") || prompt.includes("over time")) {
          const data = getChartDataByPreset("transactions-over-time", results);
          setChartData(data);
          setChartType("line");
        } else if (prompt.includes("bar") || prompt.includes("distribution")) {
          const data = getChartDataByPreset("amount-distribution", results);
          setChartData(data);
          setChartType("bar");
        } else if (prompt.includes("pie") || prompt.includes("breakdown")) {
          const data = getChartDataByPreset("status-breakdown", results);
          setChartData(data);
          setChartType("pie");
        } else if (prompt.includes("area") || prompt.includes("cumulative") || prompt.includes("revenue")) {
          const data = getChartDataByPreset("daily-revenue", results);
          setChartData(data);
          setChartType("area");
        } else {
          // Default to line chart
          const data = getChartDataByPreset("transactions-over-time", results);
          setChartData(data);
          setChartType("line");
        }
        
        toast.success("Chart generated from your prompt!");
      }
    } catch (error) {
      toast.error("Failed to generate chart");
      console.error(error);
    } finally {
      setIsGeneratingChart(false);
    }
  };

  const exportToCSV = () => {
    const headers =
      dataSource === "sql" || dataSource === "wizard" || dataSource === "form"
        ? [
            "Transaction ID",
            "ZIP Code",
            "Payment ID",
            "Amount",
            "Card Type",
            "Last Four",
            "Date",
            "Status",
          ]
        : ["Transaction ID", "ZIP Code", "Status"];

    const rows = results.map((r) => {
      if (
        dataSource === "sql" ||
        dataSource === "wizard" ||
        dataSource === "form"
      ) {
        return [
          r.transactionId,
          r.zipCode,
          r.paymentId || "",
          r.amount ? `$${Number(r.amount).toFixed(2)}` : "",
          r.cardType || "",
          r.lastFour || "",
          r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "",
          r.status || "Success",
        ];
      }
      return [r.transactionId, r.zipCode, r.status || "Success"];
    });

    const errorRows = errors.map((e) => {
      if (
        dataSource === "sql" ||
        dataSource === "wizard" ||
        dataSource === "form"
      ) {
        return [e.transactionId, "", "", "", "", "", "", `Error: ${e.error}`];
      }
      return [e.transactionId, "", `Error: ${e.error}`];
    });

    const csvContent = [headers, ...rows, ...errorRows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zip-codes-export-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("CSV exported successfully");
  };

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <Toaster position="top-right" />

      <h1 className="text-3xl font-bold mb-4">Crunchy Playground</h1>

      <div className="mb-8 flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={checkZips}
              onChange={(e) => setCheckZips(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-11 h-6 rounded-full transition-colors ${
                checkZips ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition-transform transform ${
                  checkZips ? "translate-x-5" : "translate-x-0.5"
                } mt-0.5`}
              />
            </div>
          </div>
          <span className="text-lg font-medium">Check ZIPs</span>
        </label>
        <span className="text-sm text-gray-600">
          {checkZips
            ? "Will fetch ZIP codes from Worldpay API"
            : "Database query only"}
        </span>
      </div>

      <div className="space-y-6">
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Data Source</h2>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6">
            <button
              onClick={() => setDataSource("sql")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                dataSource === "sql"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              <Code size={20} />
              SQL
            </button>
            <button
              onClick={() => setDataSource("wizard")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                dataSource === "wizard"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              <Wand2 size={20} />
              Wizard
            </button>
            <button
              onClick={() => setDataSource("form")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                dataSource === "form"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              <FormInput size={20} />
              Form
            </button>
          </div>

          <div className="space-y-4">
            {dataSource === "sql" && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  SQL Query <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  className="w-full h-48 p-3 border rounded-md font-mono text-sm"
                  placeholder="SELECT id, transaction_id, status, amount AS guest_payment_amount, refund_amount, amount - refund_amount AS amount, created_at, updated_at
FROM payments
WHERE payment_gateway_id IS NOT NULL
ORDER BY id DESC
LIMIT 100"
                  disabled={isProcessing}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your custom SQL query. Be careful with data
                  modifications.
                </p>
              </div>
            )}

            {dataSource === "wizard" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium mb-2">
                      Natural Language Query{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={naturalLanguageQuery}
                      onChange={(e) => setNaturalLanguageQuery(e.target.value)}
                      className="w-full h-32 p-3 border rounded-md text-sm"
                      placeholder="Examples:
• Show me all payments from the last 30 days
• Find transactions over $100 that failed
• Get all successful payments with ZIP codes from this year
• Show payments for user ID 12345 sorted by amount"
                      disabled={isProcessing}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Describe what data you want in plain English. I&apos;ll
                      convert it to SQL automatically.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Limit Results
                    </label>
                    <select
                      value={wizardLimit}
                      onChange={(e) => setWizardLimit(parseInt(e.target.value))}
                      className="w-full p-2 border rounded-md"
                      disabled={isProcessing}
                    >
                      <option value={10}>10 rows</option>
                      <option value={25}>25 rows</option>
                      <option value={50}>50 rows</option>
                      <option value={100}>100 rows</option>
                      <option value={250}>250 rows</option>
                      <option value={500}>500 rows</option>
                      <option value={1000}>1000 rows</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum number of results to return
                    </p>
                  </div>
                </div>

                {generatedSQL && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Generated SQL (you can edit this)
                    </label>
                    <textarea
                      value={generatedSQL}
                      onChange={(e) => setGeneratedSQL(e.target.value)}
                      className="w-full h-24 p-3 border rounded-md font-mono text-sm bg-gray-50"
                      disabled={isProcessing}
                    />
                  </div>
                )}
              </div>
            )}

            {dataSource === "form" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Database Table <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    disabled={isProcessing}
                  >
                    <option value="payments_fdw">Payments</option>
                    <option value="events_fdw">Events</option>
                    <option value="users_fdw">Users</option>
                    <option value="payments_with_events">
                      Payments with Events (JOIN)
                    </option>
                    <option value="payments_with_users">
                      Payments with Users (JOIN)
                    </option>
                  </select>
                </div>

                {selectedTable.includes("payments") && (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Payment Filters
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Status
                        </label>
                        <select
                          value={formFilters.status}
                          onChange={(e) =>
                            setFormFilters({
                              ...formFilters,
                              status: e.target.value,
                            })
                          }
                          className="w-full p-2 text-sm border rounded-md"
                          disabled={isProcessing}
                        >
                          <option value="">All Statuses</option>
                          <option value="success">Success</option>
                          <option value="refund">Refund</option>
                          <option value="cancel">Cancel</option>
                          <option value="void">Void</option>
                          <option value="batched">Batched</option>
                          <option value="transfer">Transfer</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Card Type
                        </label>
                        <select
                          value={formFilters.cardType}
                          onChange={(e) =>
                            setFormFilters({
                              ...formFilters,
                              cardType: e.target.value,
                            })
                          }
                          className="w-full p-2 text-sm border rounded-md"
                          disabled={isProcessing}
                        >
                          <option value="">All Card Types</option>
                          <option value="Visa">Visa</option>
                          <option value="Mastercard">Mastercard</option>
                          <option value="MasterCard">MasterCard</option>
                          <option value="American Express">
                            American Express
                          </option>
                          <option value="AMERICAN EXPRESS">
                            AMERICAN EXPRESS
                          </option>
                          <option value="Apple Pay - Visa">
                            Apple Pay - Visa
                          </option>
                          <option value="Apple Pay - American Express">
                            Apple Pay - American Express
                          </option>
                          <option value="Unknown">Unknown</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Date From
                        </label>
                        <input
                          type="date"
                          value={formFilters.dateFrom}
                          onChange={(e) =>
                            setFormFilters({
                              ...formFilters,
                              dateFrom: e.target.value,
                            })
                          }
                          className="w-full p-2 text-sm border rounded-md"
                          disabled={isProcessing}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Date To
                        </label>
                        <input
                          type="date"
                          value={formFilters.dateTo}
                          onChange={(e) =>
                            setFormFilters({
                              ...formFilters,
                              dateTo: e.target.value,
                            })
                          }
                          className="w-full p-2 text-sm border rounded-md"
                          disabled={isProcessing}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Min Amount ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formFilters.minAmount}
                          onChange={(e) =>
                            setFormFilters({
                              ...formFilters,
                              minAmount: e.target.value,
                            })
                          }
                          className="w-full p-2 text-sm border rounded-md"
                          placeholder="0.00"
                          disabled={isProcessing}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Max Amount ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formFilters.maxAmount}
                          onChange={(e) =>
                            setFormFilters({
                              ...formFilters,
                              maxAmount: e.target.value,
                            })
                          }
                          className="w-full p-2 text-sm border rounded-md"
                          placeholder="No limit"
                          disabled={isProcessing}
                        />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formFilters.hasGatewayId}
                          onChange={(e) =>
                            setFormFilters({
                              ...formFilters,
                              hasGatewayId: e.target.checked,
                            })
                          }
                          disabled={isProcessing}
                        />
                        <span className="text-gray-700">
                          Has Payment Gateway ID
                        </span>
                        <span className="text-xs text-gray-500">
                          (~954 payments - for ZIP code lookup)
                        </span>
                      </label>
                    </div>

                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formFilters.hasTransactionId}
                          onChange={(e) =>
                            setFormFilters({
                              ...formFilters,
                              hasTransactionId: e.target.checked,
                            })
                          }
                          disabled={isProcessing}
                        />
                        <span className="text-gray-700">
                          Has Transaction ID
                        </span>
                        <span className="text-xs text-gray-500">
                          (for Worldpay API calls)
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Host User ID
                      </label>
                      <input
                        type="number"
                        value={formFilters.hostUserId}
                        onChange={(e) =>
                          setFormFilters({
                            ...formFilters,
                            hostUserId: e.target.value,
                          })
                        }
                        className="w-full p-2 text-sm border rounded-md"
                        placeholder="Enter host user ID (e.g., 14874)"
                        disabled={isProcessing}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Find payments for events hosted by this user
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Limit Results
                    </label>
                    <select
                      value={formFilters.limit}
                      onChange={(e) =>
                        setFormFilters({
                          ...formFilters,
                          limit: parseInt(e.target.value),
                        })
                      }
                      className="w-full p-2 border rounded-md"
                      disabled={isProcessing}
                    >
                      <option value={10}>10 rows</option>
                      <option value={25}>25 rows</option>
                      <option value={50}>50 rows</option>
                      <option value={100}>100 rows</option>
                      <option value={250}>250 rows</option>
                      <option value={500}>500 rows</option>
                      <option value={1000}>1000 rows</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Sort By
                    </label>
                    <select
                      value={sortOption}
                      onChange={(e) => {
                        const parts = e.target.value.split("_");
                        const orderDirection = parts.pop() || "DESC"; // Get the last part (ASC/DESC)
                        const orderBy = parts.join("_"); // Join the rest back together
                        setSortOption(e.target.value);
                        setFormFilters({
                          ...formFilters,
                          orderBy,
                          orderDirection,
                        });
                      }}
                      className="w-full p-2 border rounded-md"
                      disabled={isProcessing}
                    >
                      <option value="created_at_DESC">Newest First</option>
                      <option value="created_at_ASC">Oldest First</option>
                      <option value="amount_DESC">Highest Amount</option>
                      <option value="amount_ASC">Lowest Amount</option>
                      <option value="id_DESC">Latest ID</option>
                      <option value="id_ASC">Earliest ID</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="text-sm font-medium text-gray-700">
                    Preview SQL:
                  </p>
                  <pre className="text-xs font-mono text-gray-600 mt-1 whitespace-pre-wrap">
                    {(() => {
                      let sql = "";
                      let needsEventsJoin = false;

                      if (selectedTable === "payments_with_events") {
                        sql = `SELECT p.id, p.transaction_id, p.event_id, p.amount, p.status, p.card_type, p.last_four, p.created_at, p.updated_at, p.user_id, p.payment_gateway_id, e.user_id as host_user_id FROM payments_fdw p LEFT JOIN events_fdw e ON p.event_id = e.id`;
                        needsEventsJoin = true;
                      } else if (selectedTable === "payments_with_users") {
                        sql = `SELECT p.id, p.transaction_id, p.event_id, p.amount, p.status, p.card_type, p.last_four, p.created_at, p.updated_at, p.user_id, p.payment_gateway_id, CONCAT(u.first_name, ' ', u.last_name) as full_name, u.email FROM payments_fdw p LEFT JOIN users_fdw u ON p.user_id = u.id`;
                      } else if (
                        selectedTable.includes("payments") &&
                        formFilters.hostUserId
                      ) {
                        sql = `SELECT p.id, p.transaction_id, p.event_id, p.amount, p.status, p.card_type, p.last_four, p.created_at, p.updated_at, p.user_id, p.payment_gateway_id, e.user_id as host_user_id FROM payments_fdw p LEFT JOIN events_fdw e ON p.event_id = e.id`;
                        needsEventsJoin = true;
                      } else {
                        sql = `SELECT * FROM ${selectedTable}`;
                      }

                      const conditions = [];
                      const tablePrefix =
                        selectedTable === "payments_with_events" ||
                        selectedTable === "payments_with_users" ||
                        needsEventsJoin
                          ? "p."
                          : "";

                      if (selectedTable.includes("payments")) {
                        if (formFilters.status)
                          conditions.push(
                            `${tablePrefix}status = '${formFilters.status}'`
                          );
                        if (formFilters.cardType)
                          conditions.push(
                            `${tablePrefix}card_type = '${formFilters.cardType}'`
                          );
                        if (formFilters.dateFrom)
                          conditions.push(
                            `${tablePrefix}created_at >= '${formFilters.dateFrom}'`
                          );
                        if (formFilters.dateTo)
                          conditions.push(
                            `${tablePrefix}created_at <= '${formFilters.dateTo} 23:59:59'`
                          );
                        if (formFilters.minAmount)
                          conditions.push(
                            `${tablePrefix}amount >= ${formFilters.minAmount}`
                          );
                        if (formFilters.maxAmount)
                          conditions.push(
                            `${tablePrefix}amount <= ${formFilters.maxAmount}`
                          );
                        if (formFilters.hasGatewayId)
                          conditions.push(
                            `${tablePrefix}payment_gateway_id IS NOT NULL`
                          );
                        if (formFilters.hasTransactionId)
                          conditions.push(
                            `${tablePrefix}transaction_id IS NOT NULL`
                          );
                        if (formFilters.hostUserId) {
                          conditions.push(
                            `e.user_id = ${
                              parseInt(formFilters.hostUserId) || 0
                            }`
                          );
                        }
                      }

                      if (conditions.length > 0) {
                        sql += `\nWHERE ${conditions.join(" AND ")}`;
                      }

                      sql += `\nORDER BY ${
                        selectedTable === "payments_with_events" ||
                        selectedTable === "payments_with_users" ||
                        needsEventsJoin
                          ? "p."
                          : ""
                      }${formFilters.orderBy} ${formFilters.orderDirection}`;
                      sql += `\nLIMIT ${formFilters.limit}`;

                      return sql;
                    })()}
                  </pre>
                </div>
              </div>
            )}


            <div className="flex items-center gap-4">

              <button
                onClick={handleProcess}
                disabled={
                  isProcessing ||
                  (dataSource === "sql"
                    ? !sqlQuery.trim()
                    : dataSource === "wizard"
                    ? !naturalLanguageQuery.trim()
                    : false) // form tab doesn't need validation
                }
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    {dataSource === "sql"
                      ? checkZips
                        ? "Executing & Fetching ZIPs..."
                        : "Executing..."
                      : dataSource === "wizard"
                      ? checkZips
                        ? "Generating & Fetching ZIPs..."
                        : "Generating & Executing..."
                      : dataSource === "form"
                      ? checkZips
                        ? "Querying & Fetching ZIPs..."
                        : "Querying..."
                      : "Processing..."}
                  </>
                ) : dataSource === "sql" ? (
                  checkZips ? (
                    "Execute SQL & Fetch ZIPs"
                  ) : (
                    "Execute SQL Only"
                  )
                ) : dataSource === "wizard" ? (
                  checkZips ? (
                    "Generate & Execute with ZIPs"
                  ) : (
                    "Generate & Execute"
                  )
                ) : dataSource === "form" ? (
                  checkZips ? (
                    "Run Query & Fetch ZIPs"
                  ) : (
                    "Run Query Only"
                  )
                ) : (
                  "Process"
                )}
              </button>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {(results.length > 0 || errors.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Results Table */}
            <div className="bg-white border rounded-lg p-6 shadow-sm h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Results</h2>
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  <Download size={20} />
                  Export CSV
                </button>
              </div>

              <div className="overflow-auto flex-1">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-left p-2">Transaction ID</th>
                      <th className="text-left p-2">ZIP Code</th>
                      {(dataSource === "sql" ||
                        dataSource === "wizard" ||
                        dataSource === "form") && (
                        <>
                          <th className="text-left p-2">Payment ID</th>
                          <th className="text-left p-2">Amount</th>
                          <th className="text-left p-2">Card</th>
                          <th className="text-left p-2">Date</th>
                        </>
                      )}
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, idx) =>
                      [
                        <tr
                          key={`result-${idx}`}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="p-2 font-mono text-sm">
                            {result.transactionId}
                          </td>
                          <td className="p-2 font-semibold">{result.zipCode}</td>
                          {(dataSource === "sql" ||
                            dataSource === "wizard" ||
                            dataSource === "form") && (
                            <>
                              <td className="p-2 text-sm">
                                {result.paymentId || "-"}
                              </td>
                              <td className="p-2">
                                {result.amount
                                  ? `$${Number(result.amount).toFixed(2)}`
                                  : "-"}
                              </td>
                              <td className="p-2 text-sm">
                                {result.cardType && result.lastFour
                                  ? `${result.cardType} ****${result.lastFour}`
                                  : "-"}
                              </td>
                              <td className="p-2 text-sm">
                                {result.createdAt
                                  ? new Date(
                                      result.createdAt
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                            </>
                          )}
                          <td className="p-2">
                            <span
                              className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                result.status === "SUCCESS"
                                  ? "bg-green-100 text-green-800"
                                  : result.status === "FAILED"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {result.status || "Success"}
                            </span>
                          </td>
                        </tr>,
                        result.fullResponse && (
                          <tr
                            key={`response-${idx}`}
                            className="border-b bg-gray-50"
                          >
                            <td
                              colSpan={
                                dataSource === "sql" ||
                                dataSource === "wizard" ||
                                dataSource === "form"
                                  ? 7
                                  : 3
                              }
                              className="p-2"
                            >
                              <details>
                                <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                                  {dataSource === "sql" ||
                                  dataSource === "wizard" ||
                                  dataSource === "form"
                                    ? "View Raw Data"
                                    : "View API Response"}
                                </summary>
                                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                                  {JSON.stringify(result.fullResponse, null, 2)}
                                </pre>
                              </details>
                            </td>
                          </tr>
                        ),
                      ].filter(Boolean)
                    )}
                    {errors.map((error, idx) => (
                      <tr
                        key={`error-${idx}`}
                        className="border-b hover:bg-gray-50"
                      >
                        <td className="p-2 font-mono text-sm">
                          {error.transactionId}
                        </td>
                        <td className="p-2">-</td>
                        {(dataSource === "sql" ||
                          dataSource === "wizard" ||
                          dataSource === "form") && (
                          <>
                            <td className="p-2">-</td>
                            <td className="p-2">-</td>
                            <td className="p-2">-</td>
                            <td className="p-2">-</td>
                          </>
                        )}
                        <td className="p-2 text-red-600 text-sm">
                          {error.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 text-sm text-gray-600 border-t pt-2">
                Total: {results.length + errors.length} | Successful:{" "}
                {results.length} | Failed: {errors.length}
              </div>
            </div>

            {/* Chart Card */}
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 size={20} />
                  Data Visualization
                </CardTitle>
                <CardDescription>
                  Generate charts from your query results
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Chart Display Area */}
                <div className="flex-1 min-h-0 mb-4">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      {((() => {
                        if (chartType === "line") return (
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey={Object.keys(chartData[0])[0]} 
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey={Object.keys(chartData[0])[1]} 
                            stroke="var(--chart-1)" 
                            strokeWidth={2}
                          />
                        </LineChart>
                        );
                        if (chartType === "bar") return (
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey={Object.keys(chartData[0])[0]} 
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar 
                            dataKey={Object.keys(chartData[0])[1]} 
                            fill="var(--chart-2)" 
                          />
                        </BarChart>
                        );
                        if (chartType === "area") return (
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey={Object.keys(chartData[0])[0]} 
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Area 
                            type="monotone" 
                            dataKey="revenue" 
                            stackId="1"
                            stroke="var(--chart-1)" 
                            fill="var(--chart-1)" 
                            fillOpacity={0.6}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="cumulative" 
                            stackId="2"
                            stroke="var(--chart-2)" 
                            fill="var(--chart-2)" 
                            fillOpacity={0.3}
                          />
                        </AreaChart>
                        );
                        if (chartType === "pie") return (
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => {
                              const labelKey = Object.keys(entry)[0];
                              return `${entry[labelKey]}: ${entry.percentage || entry.count}%`;
                            }}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="count"
                          >
                            {chartData.map((_entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={`var(--chart-${(index % 5) + 1})`} 
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                        );
                        return null;
                      })()) as React.ReactElement}
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-gray-600 font-medium">No chart generated yet</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Select a preset or enter a custom prompt below
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chart Controls */}
                <div className="space-y-3 border-t pt-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Standard Charts
                    </label>
                    <select
                      value={selectedChart}
                      onChange={(e) => {
                        setSelectedChart(e.target.value);
                        setCustomPrompt("");
                      }}
                      className="w-full p-2 border rounded-md text-sm"
                      disabled={isGeneratingChart}
                    >
                      <option value="">Select a chart preset...</option>
                      {CHART_PRESETS.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label} - {preset.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Custom Chart Request
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customPrompt}
                        onChange={(e) => {
                          setCustomPrompt(e.target.value);
                          setSelectedChart("");
                        }}
                        placeholder="e.g., Plot transactions on a line chart"
                        className="flex-1 p-2 border rounded-md text-sm"
                        disabled={isGeneratingChart}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            generateChart();
                          }
                        }}
                      />
                      <button
                        onClick={generateChart}
                        disabled={isGeneratingChart || (!selectedChart && !customPrompt.trim())}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                      >
                        {isGeneratingChart ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Send size={16} />
                        )}
                        View Chart
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
