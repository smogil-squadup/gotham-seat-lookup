# Database Query Tab - Removed Feature Documentation

## Overview
This document preserves the Database Query tab functionality that was removed in favor of the more flexible SQL tab. The Database Query tab provided a structured interface for querying payments with specific filters.

## Original Functionality

### User Interface Elements
- **Host User ID Field** (Required): Filter transactions by event host/owner
- **Date From/To Fields** (Optional): Date range filtering using DatePicker components
- **Transaction IDs Field** (Optional): Specific transaction IDs to query
- **Check Connection Button**: Test database connectivity

### API Endpoint
- **Route**: `/api/query-transactions`
- **Methods**: GET (connection test), POST (query execution)

### Query Parameters
```typescript
interface PaymentSearchParams {
  transactionIds?: string[];
  dateFrom?: string;  // Format: 'yyyy-MM-dd'
  dateTo?: string;    // Format: 'yyyy-MM-dd'
  hostUserId?: number; // Required
  limit?: number;     // Default: 1000, Max: 1000
  offset?: number;
}
```

### Database Query Logic
The tab used the `searchPayments` function from `lib/db.ts` which:
1. Joined `payments` with `events` table to filter by host user
2. Applied optional filters for transaction IDs and date ranges
3. Limited results for performance
4. Used parameterized queries for security

### SQL Query Generated
```sql
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
FROM payments p
LEFT JOIN events e ON p.event_id = e.id
WHERE 1=1
  AND e.user_id = $1           -- Host User ID filter
  AND p.created_at::date >= $2 -- Optional date from
  AND p.created_at::date <= $3 -- Optional date to
  AND p.transaction_id = ANY($4) -- Optional transaction IDs
ORDER BY p.created_at DESC
LIMIT $5 OFFSET $6
```

### Worldpay Integration
After fetching payments from database, the tab:
1. Iterated through each payment record
2. Called Worldpay API with `fetchZipFromWorldpay()` function
3. Added 100ms delay between API calls to avoid rate limiting
4. Collected both successful ZIP codes and API errors

### UI Components Used
- **DatePicker**: Custom component for date selection
- **Database Connection Indicator**: Green/Red status with connection test
- **Progress Bar**: Real-time progress during API calls
- **Results Table**: Same table format as other tabs
- **Toast Notifications**: Success/error feedback

### Code Locations (Before Removal)
- **Frontend Logic**: `app/page.tsx` - `processFromDatabase()` function
- **API Endpoint**: `app/api/query-transactions/route.ts`
- **Database Functions**: `lib/db.ts` - `searchPayments()` function
- **UI State**: Multiple React state variables for form fields

## Why It Was Removed
The SQL tab provides all the same functionality with much more flexibility:
- Users can write any SELECT query instead of being limited to predefined filters
- No need for separate host user ID requirement (can be included in WHERE clause)
- More powerful date filtering and complex conditions
- Better for advanced users who understand SQL
- Simpler codebase maintenance

## How to Recreate Database Query Functionality with SQL Tab
To replicate the old Database Query behavior, users can use these SQL patterns:

### Basic Host User Filter
```sql
SELECT p.*, e.user_id as host_user_id
FROM payments p
LEFT JOIN events e ON p.event_id = e.id  
WHERE e.user_id = 14874
ORDER BY p.created_at DESC
LIMIT 100
```

### With Date Range
```sql
SELECT p.*, e.user_id as host_user_id
FROM payments p
LEFT JOIN events e ON p.event_id = e.id  
WHERE e.user_id = 14874
  AND p.created_at::date >= '2024-01-01'
  AND p.created_at::date <= '2024-12-31'
ORDER BY p.created_at DESC
LIMIT 100
```

### With Specific Transaction IDs
```sql
SELECT p.*, e.user_id as host_user_id
FROM payments p
LEFT JOIN events e ON p.event_id = e.id  
WHERE e.user_id = 14874
  AND p.transaction_id IN ('t1_txn_123', 't1_txn_456')
ORDER BY p.created_at DESC
```

## Restoring This Feature
If needed in the future, this functionality can be restored by:
1. Adding back the 'database' option to the `DataSource` type
2. Restoring the UI elements for host user ID and date fields
3. Adding back the `processFromDatabase()` function
4. Keeping the existing `/api/query-transactions` endpoint (still exists)
5. Adding the database tab button back to the interface

The underlying database functions and API endpoint remain intact and functional.