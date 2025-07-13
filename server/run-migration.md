# How to Run the Migration

## Option 1: Using psql command line
```bash
psql -U postgres -d dump-truck-invoice -f add-model-config-id.sql
```

## Option 2: Using Prisma migrate
First, let's create a proper Prisma migration:
```bash
npx prisma migrate dev --name add-model-config-id --create-only
```

Then copy the SQL content to the generated migration file and run:
```bash
npx prisma migrate dev
```

## Option 3: Direct SQL execution
If you have a PostgreSQL client (pgAdmin, DBeaver, etc.), you can:
1. Connect to your database: `dump-truck-invoice`
2. Open a query window
3. Paste and execute the SQL from `add-model-config-id.sql`

## Option 4: Using Node.js script
Run this command in the server directory:
```bash
node -e "
const { Client } = require('pg');
const fs = require('fs');
const client = new Client({
  connectionString: 'postgresql://postgres:password123@localhost:5432/dump-truck-invoice'
});

(async () => {
  try {
    await client.connect();
    const sql = fs.readFileSync('add-model-config-id.sql', 'utf8');
    const result = await client.query(sql);
    console.log('Migration completed successfully!');
    console.log(result[result.length - 1].rows);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
})();
"
```

## After Running the Migration

Once the migration is complete, you should:

1. Uncomment the modelConfigId code in `/server/src/routes/jobs.js`
2. Uncomment the field defaults code in `/server/src/services/post-processor.js`
3. Restart your server

The modelConfigId field will then be properly saved and field defaults will be applied!