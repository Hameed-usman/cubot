import * as fs from 'fs'

async function test() {
  const pdfParse = (await import('pdf-parse')).default || require('pdf-parse')
  console.log("pdfParse type:", typeof pdfParse)
}
test()
