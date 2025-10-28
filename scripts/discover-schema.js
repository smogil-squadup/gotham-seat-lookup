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

    // Test the actual query we're using
    console.log('\n\nTesting actual seat lookup query for "edwina":');
    const testQuery = await pool.query(`
      SELECT
        ag.id,
        ag.seat_id,
        ag.seat_obj,
        ea.first_name,
        ea.last_name
      FROM attendee_guests ag
      INNER JOIN payments p ON ag.payment_id = p.id
      INNER JOIN events e ON p.event_id = e.id
      INNER JOIN event_attendees ea ON ag.event_attendee_id = ea.id
      WHERE e.user_id = $1
        AND (
          LOWER(ea.first_name) LIKE LOWER($2)
          OR LOWER(ea.last_name) LIKE LOWER($2)
        )
      ORDER BY p.created_at DESC
      LIMIT 5
    `, [9987142, '%edwina%']);

    console.log(`Found ${testQuery.rows.length} results for "edwina"`);
    testQuery.rows.forEach((row, i) => {
      console.log(`\nResult ${i + 1}:`, JSON.stringify(row, null, 2));
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

discoverSchema();
