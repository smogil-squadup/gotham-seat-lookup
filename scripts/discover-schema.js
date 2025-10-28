// Quick script to discover table schemas
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function discoverSchema() {
  try {
    console.log('Discovering table schemas...\n');

    // Get columns for event_attendees
    const eventAttendeesColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'event_attendees'
      ORDER BY ordinal_position;
    `);

    console.log('event_attendees columns:');
    eventAttendeesColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Get columns for attendee_guests
    const attendeeGuestsColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'attendee_guests'
      ORDER BY ordinal_position;
    `);

    console.log('\nattendee_guests columns:');
    attendeeGuestsColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Sample a row from attendee_guests to see structure
    const sampleGuest = await pool.query(`
      SELECT * FROM attendee_guests
      WHERE seat_obj IS NOT NULL
      LIMIT 1
    `);

    console.log('\nSample attendee_guests row with seat_obj:');
    if (sampleGuest.rows.length > 0) {
      console.log(JSON.stringify(sampleGuest.rows[0], null, 2));
    }

    // Test what the query actually returns
    console.log('\n\nTesting ACTUAL query with AT TIME ZONE:');
    const actualQuery = await pool.query(`
      SELECT
        e.id,
        e.name,
        e.start_at as original,
        (e.start_at AT TIME ZONE 'America/New_York') as with_tz
      FROM events e
      WHERE e.name LIKE '%Rick Glassman%'
      LIMIT 1
    `);

    if (actualQuery.rows.length > 0) {
      const row = actualQuery.rows[0];
      console.log('\nOriginal start_at:', row.original);
      console.log('With AT TIME ZONE:', row.with_tz);

      const d1 = new Date(row.original);
      const d2 = new Date(row.with_tz);

      console.log('\nOriginal as Date:');
      console.log('  ISO:', d1.toISOString());
      console.log('  EST format:', d1.toLocaleString('en-US', { timeZone: 'America/New_York' }));

      console.log('\nWith TZ as Date:');
      console.log('  ISO:', d2.toISOString());
      console.log('  EST format:', d2.toLocaleString('en-US', { timeZone: 'America/New_York' }));

      // Manual calculation: subtract 4 hours from 03:00 to get 23:00 (11 PM) previous day
      // To get 19:00 (7 PM) we need to subtract 8 hours
      const corrected = new Date(d1);
      corrected.setHours(corrected.getHours() - 8);
      console.log('\nCorrected (subtract 8 hours):');
      console.log('  ISO:', corrected.toISOString());
      console.log('  EST format:', corrected.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

discoverSchema();
