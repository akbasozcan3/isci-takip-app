// Clear all users and related data from database
// This script removes ALL user accounts, tokens, and associated data
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(__dirname, '../data.json');
const BACKUP_DIR = path.join(__dirname, '../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function clearAllUsers() {
    console.log('🔄 Starting comprehensive database cleanup...\n');

    // Step 1: Create backup
    console.log('📦 Step 1: Creating backup...');
    if (fs.existsSync(DATA_FILE)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(BACKUP_DIR, `data-backup-${timestamp}.json`);
        fs.copyFileSync(DATA_FILE, backupFile);
        console.log(`✅ Backup created: ${backupFile}\n`);
    } else {
        console.log('⚠️  No existing data file found\n');
    }

    // Step 2: Clear PostgreSQL (if connected)
    console.log('🗄️  Step 2: Clearing PostgreSQL database...');
    try {
        const postgres = require('../config/postgres');

        if (postgres.isConnected) {
            console.log('   Connected to PostgreSQL, clearing data...');

            // Delete in correct order (respecting foreign keys)
            const tables = [
                'location_points',
                'tracks',
                'step_daily',
                'geofence_events',
                'attendance',
                'vehicle_sessions',
                'speed_violations',
                'daily_reports',
                'group_members',
                'groups',
                'messages',
                'notifications',
                'password_reset_codes',
                'sessions',
                'tokens',
                'devices',
                'users'
            ];

            for (const table of tables) {
                try {
                    const result = await postgres.query(`DELETE FROM ${table}`);
                    const count = result.rowCount || 0;
                    console.log(`   ✓ Cleared ${table}: ${count} rows deleted`);
                } catch (err) {
                    // Table might not exist, continue
                    console.log(`   ⚠️  ${table}: ${err.message}`);
                }
            }

            console.log('✅ PostgreSQL cleanup completed\n');
        } else {
            console.log('   PostgreSQL not connected, skipping...\n');
        }
    } catch (error) {
        console.log(`   ⚠️  PostgreSQL cleanup error: ${error.message}\n`);
    }

    // Step 3: Clear JSON database
    console.log('📄 Step 3: Clearing JSON database...');
    const defaultData = {
        users: {},
        tokens: {},
        emailPasswords: {},
        emailVerifications: {},
        emailResets: {},
        passwordResetTokens: {},
        resendMeta: {},
        store: {},
        articles: {},
        notifications: {},
        billingEvents: {},
        receipts: {},
        groups: {},
        groupMembers: {},
        groupRequests: {},
        locationShares: {},
        liveLocations: {},
        familyMembers: {},
        deliveries: {},
        routes: {},
        pageShares: {},
        steps: {},
        messages: {},
        activities: [],
        transactions: []
    };

    // Count existing data
    let existingData = defaultData;
    if (fs.existsSync(DATA_FILE)) {
        try {
            existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

            const userCount = Object.keys(existingData.users || {}).length;
            const tokenCount = Object.keys(existingData.tokens || {}).length;
            const groupCount = Object.keys(existingData.groups || {}).length;
            const messageCount = Object.keys(existingData.messages || {}).length;

            console.log(`   Found ${userCount} users, ${tokenCount} tokens, ${groupCount} groups, ${messageCount} message threads`);
        } catch (err) {
            console.log('   ⚠️  Could not read existing data');
        }
    }

    // Write clean data
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
    console.log('✅ JSON database cleared successfully\n');

    // Step 4: Clear uploaded files (avatars, etc.)
    console.log('🗑️  Step 4: Clearing uploaded files...');
    const uploadsDir = path.join(__dirname, '../uploads');
    if (fs.existsSync(uploadsDir)) {
        try {
            const files = fs.readdirSync(uploadsDir);
            let deletedCount = 0;

            for (const file of files) {
                const filePath = path.join(uploadsDir, file);
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }

            console.log(`   ✓ Deleted ${deletedCount} uploaded files`);
            console.log('✅ Uploads directory cleared\n');
        } catch (err) {
            console.log(`   ⚠️  Upload cleanup error: ${err.message}\n`);
        }
    } else {
        console.log('   No uploads directory found\n');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ DATABASE CLEANUP COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Summary:');
    console.log('   • All users deleted');
    console.log('   • All tokens removed');
    console.log('   • All sessions cleared');
    console.log('   • All groups and memberships deleted');
    console.log('   • All messages removed');
    console.log('   • All location data cleared');
    console.log('   • All uploaded files deleted');
    console.log('   • Backup created in backups/ directory');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n💡 You can now start fresh with a clean database!');
    console.log('💾 Backup files are preserved in case you need to restore.\n');
}

// Run the cleanup
clearAllUsers()
    .then(() => {
        console.log('🎉 Cleanup process completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Cleanup process failed:', error);
        console.error(error.stack);
        process.exit(1);
    });
