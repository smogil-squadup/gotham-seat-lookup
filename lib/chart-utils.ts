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
  paymentId?: number;
  userId?: number;
  eventId?: number;
  eventAttendeeId?: number;
}

export type ChartType = "line" | "bar" | "area" | "pie";

export interface ChartPreset {
  label: string;
  value: string;
  type: ChartType;
  description: string;
}

export const CHART_PRESETS: ChartPreset[] = [
  {
    label: "Transactions Over Time",
    value: "transactions-over-time",
    type: "line",
    description: "Show transaction count by date"
  },
  {
    label: "Amount Distribution",
    value: "amount-distribution", 
    type: "bar",
    description: "Show distribution of payment amounts"
  },
  {
    label: "Payment Status Breakdown",
    value: "status-breakdown",
    type: "pie",
    description: "Show breakdown by payment status"
  },
  {
    label: "Daily Revenue",
    value: "daily-revenue",
    type: "area",
    description: "Show cumulative revenue by day"
  },
  {
    label: "Card Type Distribution",
    value: "card-type-distribution",
    type: "pie",
    description: "Show breakdown by card type"
  },
  {
    label: "Top ZIP Codes",
    value: "top-zip-codes",
    type: "bar",
    description: "Show top 10 ZIP codes by transaction count"
  }
];

export function processTransactionsOverTime(results: Result[]) {
  const dateGroups = results.reduce((acc, result) => {
    if (result.createdAt) {
      const date = new Date(result.createdAt).toLocaleDateString();
      acc[date] = (acc[date] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(dateGroups)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([date, count]) => ({
      date,
      transactions: count
    }));
}

export function processAmountDistribution(results: Result[]) {
  const ranges = [
    { label: "$0-50", min: 0, max: 50, count: 0 },
    { label: "$50-100", min: 50, max: 100, count: 0 },
    { label: "$100-250", min: 100, max: 250, count: 0 },
    { label: "$250-500", min: 250, max: 500, count: 0 },
    { label: "$500+", min: 500, max: Infinity, count: 0 }
  ];

  results.forEach(result => {
    if (result.amount) {
      const amount = Number(result.amount);
      const range = ranges.find(r => amount >= r.min && amount < r.max);
      if (range) range.count++;
    }
  });

  return ranges.map(({ label, count }) => ({
    range: label,
    count
  }));
}

export function processStatusBreakdown(results: Result[]) {
  const statusGroups = results.reduce((acc, result) => {
    const status = result.status || "Unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(statusGroups).map(([status, count]) => ({
    status,
    count,
    percentage: Math.round((count / results.length) * 100)
  }));
}

export function processDailyRevenue(results: Result[]) {
  const dateGroups = results.reduce((acc, result) => {
    if (result.createdAt && result.amount) {
      const date = new Date(result.createdAt).toLocaleDateString();
      acc[date] = (acc[date] || 0) + Number(result.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  let cumulative = 0;
  return Object.entries(dateGroups)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([date, revenue]) => {
      cumulative += revenue;
      return {
        date,
        revenue: Number(revenue.toFixed(2)),
        cumulative: Number(cumulative.toFixed(2))
      };
    });
}

export function processCardTypeDistribution(results: Result[]) {
  const cardGroups = results.reduce((acc, result) => {
    const cardType = result.cardType || "Unknown";
    acc[cardType] = (acc[cardType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(cardGroups).map(([cardType, count]) => ({
    cardType,
    count,
    percentage: Math.round((count / results.length) * 100)
  }));
}

export function processTopZipCodes(results: Result[]) {
  const zipGroups = results.reduce((acc, result) => {
    if (result.zipCode && result.zipCode !== "-") {
      acc[result.zipCode] = (acc[result.zipCode] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(zipGroups)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([zipCode, count]) => ({
      zipCode,
      count
    }));
}

export function getChartDataByPreset(preset: string, results: Result[]) {
  switch (preset) {
    case "transactions-over-time":
      return processTransactionsOverTime(results);
    case "amount-distribution":
      return processAmountDistribution(results);
    case "status-breakdown":
      return processStatusBreakdown(results);
    case "daily-revenue":
      return processDailyRevenue(results);
    case "card-type-distribution":
      return processCardTypeDistribution(results);
    case "top-zip-codes":
      return processTopZipCodes(results);
    default:
      return [];
  }
}

export function getChartConfig(preset: string) {
  switch (preset) {
    case "transactions-over-time":
      return {
        transactions: {
          label: "Transactions",
          color: "var(--chart-1)"
        }
      };
    case "amount-distribution":
      return {
        count: {
          label: "Count",
          color: "var(--chart-2)"
        }
      };
    case "status-breakdown":
      return {
        SUCCESS: { label: "Success", color: "var(--chart-1)" },
        FAILED: { label: "Failed", color: "var(--chart-2)" },
        PENDING: { label: "Pending", color: "var(--chart-3)" },
        Unknown: { label: "Unknown", color: "var(--chart-4)" }
      };
    case "daily-revenue":
      return {
        revenue: {
          label: "Daily Revenue",
          color: "var(--chart-1)"
        },
        cumulative: {
          label: "Cumulative",
          color: "var(--chart-2)"
        }
      };
    case "card-type-distribution":
      return {
        Visa: { label: "Visa", color: "var(--chart-1)" },
        Mastercard: { label: "Mastercard", color: "var(--chart-2)" },
        "American Express": { label: "Amex", color: "var(--chart-3)" },
        Unknown: { label: "Unknown", color: "var(--chart-4)" }
      };
    case "top-zip-codes":
      return {
        count: {
          label: "Transactions",
          color: "var(--chart-3)"
        }
      };
    default:
      return {};
  }
}