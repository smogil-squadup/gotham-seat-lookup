# Database Setup Guide

This guide explains how to connect the Worldpay ZIP Code Extractor to your CrunchyBridge PostgreSQL database.

## Prerequisites

- A CrunchyBridge PostgreSQL database instance
- Read-only database credentials
- Node.js and npm installed

## Configuration Steps

### 1. Update Environment Variables

Edit the `.env.local` file and replace the placeholder values with your actual database credentials:

```env
# Option 1: Using DATABASE_URL (recommended)
DATABASE_URL=postgres://username:password@your-database.crunchy.cloud:5432/your_database_name

# Option 2: Using individual variables
DB_HOST=your-database.crunchy.cloud
DB_PORT=5432
DB_DATABASE=your_database_name
DB_USER=your_readonly_username
DB_PASSWORD=your_password
```

### 2. Database Table Structure

Your database should have a `payments` table. The app will extract ZIP codes from the `shipping_address` JSON field. Key columns used:

```sql
-- Expected payments table structure
CREATE TABLE payments (
    id BIGINT PRIMARY KEY,
    transaction VARCHAR,
    status VARCHAR,
    event VARCHAR,
    "user" VARCHAR,
    event_attendee VARCHAR,
    name_on_card VARCHAR,
    card_type VARCHAR,
    last_four VARCHAR,
    amount DECIMAL,
    created_at TIMESTAMP,
    shipping_address JSON,  -- ZIP code extracted from this field
    payment_metadata JSON,
    -- ... other columns
);
```

The app extracts ZIP codes from the `shipping_address` JSON field, looking for keys like `zip`, `postal_code`, or `postalCode`.

### 3. Create Read-Only User (Recommended)

For security, create a dedicated read-only user:

```sql
-- Create a read-only role
CREATE ROLE readonly_user WITH LOGIN PASSWORD 'secure_password';

-- Grant connect privilege
GRANT CONNECT ON DATABASE your_database TO readonly_user;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO readonly_user;

-- Grant select on all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- Grant select on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;
```

### 4. Test the Connection

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to http://localhost:3000

3. Click on "Database Query" tab

4. Click "Check Connection" to verify the database connection

## Usage

### Query by Transaction IDs
1. Switch to "Database Query" mode
2. Enter transaction IDs in the text area
3. Click "Query Database"

### Query by Date Range
1. Switch to "Database Query" mode
2. Select a date range using the date pickers
3. Click "Query Database"

### Combined Query
You can query by both transaction IDs and date range simultaneously.

## Security Notes

- The database connection is configured with read-only mode at the connection level
- All queries have a 30-second timeout to prevent long-running queries
- Connection pooling is limited to 10 concurrent connections
- SSL is enabled by default for secure connections

## Troubleshooting

### Connection Failed
- Verify your database credentials in `.env.local`
- Ensure your database is accessible from your network
- Check if SSL is required for your database

### Query Timeouts
- The default timeout is 30 seconds
- You can adjust `DB_STATEMENT_TIMEOUT` in `.env.local`

### No Results
- Verify the table name is `payments` and column names match your database schema
- Check if the user has SELECT permissions on the payments table
- Ensure the `shipping_address` column contains valid JSON with ZIP code data