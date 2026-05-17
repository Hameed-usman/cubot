import { Pool } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const dbUrl = 'postgresql://neondb_owner:npg_3PAujYmt6JcE@ep-aged-silence-ap6pw6y0-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
    const pool = new Pool({ connectionString: dbUrl });
    
    try {
        const schema = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf-8');
        await pool.query(schema);
        console.log('Schema executed successfully.');
    } catch (e) {
        console.error('Error executing schema:', e);
    } finally {
        await pool.end();
    }
}

main();
