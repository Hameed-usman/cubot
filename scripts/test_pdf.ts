import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
async function main() {
  const { scrapeUrlOnce } = await import('../scripts/full-site-scraper');
  const url = 'https://cu.edu.pk/ProgramsOffered/FeeStructures/3cce6efe_BS-CS%20%20%20Fall%202025.pdf';
  console.log("Scraping:", url);
  const result = await scrapeUrlOnce(url);
  console.log("Result:", result);
}

main().catch(console.error);
