import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = ai.getGenerativeModel({ model: 'gemini-embedding-001' });
    const res = await model.embedContent('hello world');
    console.log('Dimension of text-embedding-004:', res.embedding.values.length);
}
main();
