import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const req = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.GEMINI_API_KEY);
    const data = await req.json();
    console.log(data.models.filter((m: any) => m.name.includes('embed')).map((m: any) => m.name));
}
main();
