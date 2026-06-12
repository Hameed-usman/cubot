import { embedBatch } from '../lib/embeddings';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const queries = ['query1', 'query2', 'query3', 'query4'];
    const embeddings = await embedBatch(queries);
    console.log('Embeddings length:', embeddings.length);
    for (let i = 0; i < embeddings.length; i++) {
        console.log(`Embedding ${i} length:`, embeddings[i].length);
    }
}
main();
