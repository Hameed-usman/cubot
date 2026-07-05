import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function probe() {
  const r = await fetch('https://cu.edu.pk/ProgramsOffered')
  const html = await r.text()
  console.log('Status:', r.status)
  console.log('Content-Type:', r.headers.get('content-type'))
  console.log('HTML length:', html.length)
  
  // Show a snippet
  const feeIdx = html.toLowerCase().indexOf('fee')
  if (feeIdx >= 0) {
    console.log('\n--- Snippet around "fee" ---')
    console.log(html.slice(Math.max(0, feeIdx-100), feeIdx+200))
  } else {
    console.log('\nWord "fee" not found in HTML')
    console.log('\nFirst 1000 chars:')
    console.log(html.slice(0, 1000))
  }
  
  // Count <a> tags  
  const aCount = (html.match(/<a /g) || []).length
  console.log('\nTotal <a> tags:', aCount)
}

probe().catch(console.error)
