const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/isci_takip'
});

async function runMigration() {
    try {
        console.log('Running articles table migration...');

        const sqlPath = path.join(__dirname, 'migrations', 'create_articles_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await pool.query(sql);

        console.log('✅ Articles table created successfully!');
        console.log('✅ Sample articles inserted!');

        // Verify
        const result = await pool.query('SELECT COUNT(*) FROM articles');
        console.log(`📊 Total articles: ${result.rows[0].count}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
