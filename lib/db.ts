import { Pool, PoolConfig } from 'pg';

// Create a singleton pool instance
let pool: Pool | null = null;

const getPoolConfig = (): PoolConfig => {
  // Use DATABASE_URL if available, otherwise use individual env vars
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // CrunchyBridge requires SSL
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '10000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
    };
  }

  // Fallback to individual environment variables
  return {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }, // CrunchyBridge requires SSL
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '10000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
  };
};

export const getDb = (): Pool => {
  if (!pool) {
    const config = getPoolConfig();
    pool = new Pool(config);

    // Set default read-only mode for all connections
    pool.on('connect', async (client) => {
      try {
        await client.query('SET default_transaction_read_only = on');
      } catch (err) {
        console.warn('Could not set read-only mode:', err instanceof Error ? err.message : String(err));
      }

      try {
        await client.query(`SET statement_timeout = ${process.env.DB_STATEMENT_TIMEOUT || '30000'}`);
      } catch (err) {
        console.warn('Could not set statement_timeout:', err instanceof Error ? err.message : String(err));
      }
    });

    // Error handling
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
      // Don't destroy the pool on error, just log it
    });
  }

  return pool;
};

// Query helper with automatic connection management
export const query = async <T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> => {
  const db = getDb();

  try {
    const result = await db.query(text, params);
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Payment search interface
export interface PaymentSearchParams {
  transactionIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  hostUserId?: number;
  limit?: number;
  offset?: number;
}

// Payment result interface
export interface PaymentResult {
  id: number;
  transaction_id: string;
  status: string;
  name_on_card: string | null;
  card_type: string;
  last_four: string;
  amount: number;
  created_at: string;
  user_id: number | null;
  event_id: number | null;
  event_attendee_id: number | null;
  shipping_address_id: number | null;
  host_user_id: number | null;
  metadata: {
    ip_address?: string;
    [key: string]: unknown;
  } | null;
  // Note: external_payrix column exists in FDW but may cause issues
  external_payrix?: string | null;
}

// Helper function to search payments
export const searchPayments = async (params: PaymentSearchParams): Promise<PaymentResult[]> => {
  // Note: Explicitly list columns to avoid FDW column mismatch issues
  // The FDW may have columns that don't exist in the remote table
  let queryText = `
    SELECT 
      p.id,
      p.transaction_id,
      p.status,
      p.name_on_card,
      p.card_type,
      p.last_four,
      p.amount,
      p.created_at,
      p.user_id,
      p.event_id,
      p.event_attendee_id,
      p.shipping_address_id,
      p.metadata,
      e.user_id as host_user_id
    FROM payments_fdw p
    LEFT JOIN events_fdw e ON p.event_id = e.id
    WHERE 1=1
  `;
  
  const queryParams: unknown[] = [];
  let paramCount = 0;

  if (params.transactionIds && params.transactionIds.length > 0) {
    paramCount++;
    queryText += ` AND p.transaction_id = ANY($${paramCount})`;
    queryParams.push(params.transactionIds);
  }

  if (params.dateFrom) {
    paramCount++;
    queryText += ` AND p.created_at::date >= $${paramCount}::date`;
    queryParams.push(params.dateFrom);
  }

  if (params.dateTo) {
    paramCount++;
    queryText += ` AND p.created_at::date <= $${paramCount}::date`;
    queryParams.push(params.dateTo);
  }

  if (params.hostUserId) {
    paramCount++;
    queryText += ` AND e.user_id = $${paramCount}`;
    queryParams.push(params.hostUserId);
  }

  queryText += ` ORDER BY p.created_at DESC`;

  if (params.limit) {
    paramCount++;
    queryText += ` LIMIT $${paramCount}`;
    queryParams.push(params.limit);
  }

  if (params.offset) {
    paramCount++;
    queryText += ` OFFSET $${paramCount}`;
    queryParams.push(params.offset);
  }

  return query<PaymentResult>(queryText, queryParams);
};

// Seat lookup result interface
export interface SeatLookupResult {
  eventName: string;
  eventStartDate: string;
  eventStartTime: string;
  paymentId: number;
  amount: number;
  payerName: string | null;
  payerEmail: string | null;
  seatInfo: string | null;
  transactionId: string | null;
}

// Search payments by name or email for a specific host user
export const searchPaymentsByNameOrEmail = async (params: {
  searchQuery: string;
  hostUserId: number;
}): Promise<SeatLookupResult[]> => {
  // Get payments with attendee filter so we only query what we need
  const queryText = `
    SELECT
      p.id as payment_id,
      p.amount,
      p.created_at,
      p.event_id,
      p.event_attendee_id,
      ea.first_name,
      ea.last_name,
      e.start_at
    FROM payments p
    INNER JOIN events e ON p.event_id = e.id
    LEFT JOIN event_attendees ea ON p.event_attendee_id = ea.id
    WHERE e.user_id = $1
      AND (
        LOWER(ea.first_name) LIKE LOWER($2)
        OR LOWER(ea.last_name) LIKE LOWER($2)
      )
    ORDER BY p.created_at DESC
    LIMIT 50
  `;

  const searchPattern = `%${params.searchQuery}%`;

  console.log('Executing seat lookup query:', queryText);
  console.log('Query parameters:', [params.hostUserId, searchPattern]);

  try {
    const rows = await query<{
      payment_id: number;
      amount: number;
      created_at: string;
      event_id: number;
      event_attendee_id: number | null;
      first_name: string | null;
      last_name: string | null;
      start_at: string;
    }>(queryText, [params.hostUserId, searchPattern]);

    console.log('Query returned rows:', rows.length);

    // SKIP seat query for now - it times out due to lack of database indexes
    // The database needs indexes on: payment_items.payment_id and attendee_guests.payment_item_id
    const seatMap = new Map<number, string>();
    console.log('SKIPPING seat info query - database lacks proper indexes causing 30s+ timeouts');
    return rows.map((row) => {
      const startDate = new Date(row.start_at);
      const eventDate = startDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const eventTime = startDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const attendeeName = row.first_name && row.last_name
        ? `${row.first_name} ${row.last_name}`
        : row.first_name || row.last_name || null;

      const seatInfo = seatMap.get(row.payment_id) || null;

      return {
        eventName: `Event #${row.event_id}`,
        eventStartDate: eventDate,
        eventStartTime: eventTime,
        paymentId: row.payment_id,
        amount: Number(row.amount),
        payerName: attendeeName,
        payerEmail: null,
        seatInfo: seatInfo,
        transactionId: null,
      };
    });
  } catch (error) {
    console.error('Database query failed:', error);
    console.error('Query was:', queryText);
    console.error('Parameters were:', [params.hostUserId, searchPattern]);
    throw error;
  }
};

// Cleanup function
export const closeDb = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};