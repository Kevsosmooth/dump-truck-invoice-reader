import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const { Client } = pg;

async function resetDatabase() {
  // Parse DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  // Extract connection details from DATABASE_URL
  const url = new URL(databaseUrl);
  const [username, password] = url.username ? [url.username, url.password] : ['postgres', 'postgres'];
  const host = url.hostname;
  const port = url.port || 5432;
  const database = url.pathname.slice(1);

  console.log(`Connecting to PostgreSQL at ${host}:${port}...`);

  // First connect to postgres database to drop and recreate the target database
  const adminClient = new Client({
    host,
    port,
    user: username,
    password,
    database: 'postgres', // Connect to default postgres database
  });

  try {
    await adminClient.connect();
    console.log('Connected to postgres database');

    // Terminate all connections to the target database
    console.log(`Terminating connections to ${database}...`);
    await adminClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid()
    `, [database]);

    // Drop the database
    console.log(`Dropping database ${database}...`);
    await adminClient.query(`DROP DATABASE IF EXISTS "${database}"`);

    // Create the database
    console.log(`Creating database ${database}...`);
    await adminClient.query(`CREATE DATABASE "${database}"`);

    await adminClient.end();
    console.log('Database recreated successfully');

    // Now connect to the new database and run the init script
    const client = new Client({
      host,
      port,
      user: username,
      password,
      database,
    });

    await client.connect();
    console.log(`Connected to ${database} database`);

    // Read and execute the init script
    const initScriptPath = path.join(__dirname, 'prisma', 'init-database.sql');
    const initScript = fs.readFileSync(initScriptPath, 'utf8');

    console.log('Running initialization script...');
    await client.query(initScript);

    console.log('Database initialized successfully!');
    
    // Create initial admin user
    console.log('Creating initial admin user...');
    await client.query(`
      INSERT INTO "User" (email, role, credits, "isActive")
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `, ['admin@example.com', 'ADMIN', 1000, true]);

    await client.end();

    console.log('\n✅ Database reset completed successfully!');
    console.log('✅ Initial admin user created: admin@example.com');
    console.log('\nNext steps:');
    console.log('1. Run: npm run prisma:generate');
    console.log('2. The database is now ready for the Stripe payment integration');
    console.log('3. To sync with Supabase, use the generated SQL scripts');

  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  }
}

// Run the reset
resetDatabase();