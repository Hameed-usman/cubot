import * as path from 'path'
import * as dotenv from 'dotenv'

// Load env FIRST before any other imports
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import * as crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import sql from '@/lib/db'
import { classifyPage, buildBreadcrumb } from '@/lib/classifier'
import { semanticChunk } from '@/lib/textSplitter'
import { upsertPageChunks } from '@/lib/embed-and-store'
import { processDocument } from './document-processor'

// ─── Configuration ─────────────────────────────────────────────────────────────

const BASE_URL = 'https://www.cusit.edu.pk'
const ALLOWED_DOMAINS = ['cusit.edu.pk', 'www.cusit.edu.pk']
const MAX_PAGES = parseInt(process.env.CRAWLER_MAX_PAGES || '500')
const CONCURRENCY = parseInt(process.env.CRAWLER_CONCURRENCY || '5')
const REQUEST_DELAY_MS = parseInt(process.env.CRAWLER_DELAY_MS || '800')
const DRY_RUN = process.env.DRY_RUN === 'true'

const DENY_PATTERNS = [
  /\.(jpg|jpeg|png|gif|svg|ico|css|js|woff|woff2|ttf|eot|mp4|mp3|avi|zip|rar|tar|gz)(\?.*)?$/i,
  /\/(wp-admin|wp-login|wp-cron|feed|rss|sitemap\.xml|robots\.txt)/i,
  /\/(login|logout|register|cart|checkout|account)/i,
  /(facebook|twitter|youtube|linkedin|instagram|whatsapp)\.com/i,
  /mailto:|tel:|javascript:/i,
]

const DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.doc', '.pptx', '.ppt']

// ─── Types ─────────────────────────────────────────────────────────────────────

interface QueueItem {
  url: string
  depth: number
  parentUrl: string
}

interface PageResult {
  url: string
  title: string
  content: string
  status: 'success' | 'skipped' | 'failed'
  chunksCreated?: number
  error?: string
}

// ─── Crawl Stats ───────────────────────────────────────────────────────────────

const stats = {
  runId: uuidv4(),
  pagesCrawled: 0,
  pagesFailed: 0,
  pagesUpdated: 0,
  pagesSkipped: 0,
  documentsProcessed: 0,
  chunksCreated: 0,
  embeddingsCreated: 0,
  startedAt: new Date(),
}

// ─── URL Utilities ─────────────────────────────────────────────────────────────

function normalizeUrl(url: string, base: string): string | null {
  try {
    const resolved = new URL(url, base)
    // Remove fragment and normalize
    resolved.hash = ''
    // Remove common tracking params
    resolved.searchParams.delete('utm_source')
    resolved.searchParams.delete('utm_medium')
    resolved.searchParams.delete('utm_campaign')
    return resolved.href
  } catch {
    return null
  }
}

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!ALLOWED_DOMAINS.some(d => parsed.hostname === d)) return false
    if (DENY_PATTERNS.some(p => p.test(url))) return false
    return true
  } catch {
    return false
  }
}

function isDocumentUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return DOCUMENT_EXTENSIONS.some(ext => lower.includes(ext))
}

// ─── Content Extraction ────────────────────────────────────────────────────────

async function extractContent(html: string, url: string): Promise<{ title: string; content: string; links: string[] }> {
  // Dynamic import to support both environments
  const cheerio = await import('cheerio')
  const $ = cheerio.load(html)

  // 1. Extract links FIRST before we modify/remove any DOM elements
  const links: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (href) {
      const normalized = normalizeUrl(href, url)
      if (normalized) links.push(normalized)
    }
  })

  const isFacultyProfile = url.includes('profile.php')

  if (isFacultyProfile) {
    // Custom structured extraction for faculty profiles
    const name = $('h4.color-white, h4').first().text().trim() || 
                 $('title').text().trim().replace(/profile/i, '').replace(/cusit/i, '').replace(/[-|:]/g, '').trim() ||
                 'Faculty Member';
                 
    let designation = '';
    let email = '';
    let phone = '';
    let department = '';

    // Search body elements for basic profile info
    $('body').find('p, td, li, span, div, h4').each((_, el) => {
      const txt = $(el).text().replace(/\s+/g, ' ').trim();
      
      // Email check
      if (!email && txt.includes('@')) {
        const emailMatch = txt.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) email = emailMatch[0];
      }
      
      // Designation check
      if (!designation && /designation|lecturer|professor|assistant|associate|instructor/i.test(txt)) {
        if (/designation/i.test(txt)) {
          designation = txt.replace(/designation:?/i, '').trim();
        } else if (txt.length < 50) {
          designation = txt;
        }
      }

      // Department check
      if (!department && /department|dept|faculty of/i.test(txt)) {
        if (/department|dept/i.test(txt) && txt.length < 80) {
          department = txt.replace(/department:?|dept:?/i, '').trim();
        }
      }

      // Phone check
      if (!phone && /phone|cell|mobile|contact/i.test(txt)) {
        const phoneMatch = txt.match(/[\d+-]{7,}/);
        if (phoneMatch) phone = phoneMatch[0];
      }
    });

    // Pull designations from sibling nodes if empty
    if (!designation) {
      const nameEl = $('h4.color-white, h4').first();
      if (nameEl.length > 0) {
        const sib = nameEl.next('p');
        if (sib.length > 0) {
          designation = sib.text().trim();
        }
      }
    }

    // Identify sections (Publications, Specialization, Books, etc.)
    // These sections in dynamic profile pages are usually structured inside h5 or h3
    const sections: { title: string; content: string }[] = [];
    $('h3, h4, h5, h6, b, strong').each((_, el) => {
      const headingText = $(el).text().trim();
      // Skip name or too short titles
      if (!headingText || headingText.length < 3 || headingText.length > 60 || headingText === name) return;
      
      // Check if this looks like a section header (e.g. Specialization, Publication, Books, Grants, Research)
      if (/specialization|publication|research|books|qualification|education|experience|grants|thesis|interests/i.test(headingText)) {
        const contentLines: string[] = [];
        let current = $(el).next();
        
        // Traverse siblings until the next heading or a line break
        let maxSiblings = 15; // safety guard
        while (current.length > 0 && maxSiblings > 0) {
          const tagName = current[0].name;
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            break;
          }
          
          if (tagName === 'ul' || tagName === 'ol') {
            current.find('li').each((_, li) => {
              const liText = $(li).text().trim();
              if (liText) contentLines.push(`• ${liText}`);
            });
          } else {
            const txt = current.text().replace(/\s+/g, ' ').trim();
            if (txt.length > 5) {
              contentLines.push(txt);
            }
          }
          current = current.next();
          maxSiblings--;
        }
        
        if (contentLines.length > 0) {
          sections.push({
            title: headingText,
            content: contentLines.join('\n')
          });
        }
      }
    });

    // Construct clean structured markdown
    const mdParts = [
      `# Faculty Profile: ${name}`,
      designation ? `- **Designation**: ${designation}` : '',
      department ? `- **Department**: ${department}` : '',
      email ? `- **Email**: ${email}` : '',
      phone ? `- **Phone/Contact**: ${phone}` : '',
      `- **Official URL**: ${url}`,
      ''
    ].filter(Boolean);

    if (sections.length > 0) {
      for (const sec of sections) {
        mdParts.push(`## ${sec.title}`);
        mdParts.push(sec.content);
        mdParts.push('');
      }
    } else {
      // If we couldn't find structured sections, let's grab the general text
      // but without the site navigation boilerplate
      $('script, style, noscript, iframe, header, footer, nav, .navbar, .menu').remove();
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      mdParts.push('## General Information');
      mdParts.push(bodyText);
    }

    const structuredContent = mdParts.join('\n').trim();
    
    return {
      title: `Faculty Profile - ${name}`,
      content: structuredContent,
      links
    }
  }

  // ── Remove boilerplate for normal pages ───────────────────────────────────────
  $(
    'script, style, noscript, iframe, object, embed, ' +
    'nav, header, footer, aside, ' +
    '.nav, .navbar, .navigation, .menu, .header, .footer, .sidebar, ' +
    '.cookie-banner, .cookie-notice, .popup, .modal, .overlay, ' +
    '.social-share, .social-links, .share-buttons, ' +
    '.breadcrumb-nav, .pagination, .pager, ' +
    '#nav, #header, #footer, #sidebar, #menu, ' +
    '[role="navigation"], [role="banner"], [role="contentinfo"]'
  ).remove()

  // ── Extract title ────────────────────────────────────────────────────────────
  const title = (
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    'Untitled Page'
  ).replace(/\s+/g, ' ').slice(0, 200)

  // ── Extract main content ──────────────────────────────────────────────────────
  // Try semantic main content containers first
  const contentSelectors = [
    'main', 'article', '[role="main"]',
    '#content', '#main-content', '#page-content', '.content',
    '.main-content', '.entry-content', '.post-content',
    '.page-content', '.article-content',
  ]

  let contentEl = $('body')
  for (const sel of contentSelectors) {
    if ($(sel).length > 0) {
      contentEl = $(sel).first()
      break
    }
  }

  // Clean up remaining noise inside content
  contentEl.find('.wp-caption, .gallery, .related-posts, .post-navigation').remove()

  // Extract meaningful text: paragraphs, headings, lists, tables
  const textParts: string[] = []

  contentEl.find('h1, h2, h3, h4, p, li, td, th, dt, dd, blockquote').each((_, el) => {
    const tag = (el as any).tagName?.toLowerCase() || ''
    const text = $(el).text().replace(/\s+/g, ' ').trim()

    if (text.length < 10) return // Skip trivially short elements

    if (['h1', 'h2', 'h3'].includes(tag)) {
      textParts.push(`\n## ${text}\n`)
    } else if (tag === 'h4') {
      textParts.push(`\n### ${text}\n`)
    } else if (tag === 'li') {
      textParts.push(`• ${text}`)
    } else if (['td', 'th'].includes(tag)) {
      textParts.push(`| ${text}`)
    } else {
      textParts.push(text)
    }
  })

  const content = textParts.join('\n').replace(/\n{4,}/g, '\n\n\n').trim()

  return { title, content, links }
}

// ─── Page Processor ────────────────────────────────────────────────────────────

async function processPage(url: string): Promise<PageResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CubotCrawler/1.0; +https://cusit.edu.pk/cubot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(15000), // 15s timeout per page
    })

    if (!response.ok) {
      return { url, title: '', content: '', status: 'failed', error: `HTTP ${response.status}` }
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      return { url, title: '', content: '', status: 'skipped', error: 'Non-HTML content' }
    }

    const html = await response.text()
    const { title, content, links } = await extractContent(html, url)

    if (content.length < 100) {
      return { url, title, content, status: 'skipped', error: 'Insufficient content (may require JS rendering)' }
    }

    const contentHash = crypto.createHash('md5').update(content).digest('hex')
    const classification = classifyPage(url, title)
    const breadcrumb = buildBreadcrumb(url)
    const parentPageId = uuidv4()

    // Semantic chunking
    const chunks = semanticChunk(content, {
      title,
      sourceUrl: url,
      department: classification.department,
      category: classification.category,
      pageType: classification.pageType,
      breadcrumb,
      sourceType: 'webpage',
      contentHash,
      crawledAt: new Date().toISOString(),
    })

    if (!DRY_RUN && chunks.length > 0) {
      const result = await upsertPageChunks({
        chunks: chunks.map(c => ({ text: c.text, chunkIndex: c.metadata.chunkIndex })),
        title,
        category: classification.category,
        sourceUrl: url,
        sourceType: 'webpage',
        pageType: classification.pageType,
        breadcrumb,
        parentPageId,
      })

      stats.chunksCreated += result.upserted
      stats.embeddingsCreated += result.upserted
      if (result.upserted > 0) stats.pagesUpdated++
      else stats.pagesSkipped++
    } else if (DRY_RUN) {
      console.log(`  [DRY RUN] Would create ${chunks.length} chunks from: ${url}`)
      stats.pagesUpdated++
    }

    return { url, title, content, status: 'success', chunksCreated: chunks.length, links } as any

  } catch (error: any) {
    return { url, title: '', content: '', status: 'failed', error: error.message }
  }
}

// ─── Main Crawler ──────────────────────────────────────────────────────────────

const SEED_URLS = [
  'https://www.cusit.edu.pk',
  'https://cusit.edu.pk/cusitnew/cs/faculty.php',
  'https://cusit.edu.pk/cusitnew/se/faculty.php',
  'https://cusit.edu.pk/admissions.php',
]

async function runCrawler() {
  console.log(`\n🤖 Cubot Full-Site Crawler`)
  console.log(`   Run ID:     ${stats.runId}`)
  console.log(`   Seeds:      ${SEED_URLS.join(', ')}`)
  console.log(`   Max pages:  ${MAX_PAGES}`)
  console.log(`   Concurrency: ${CONCURRENCY}`)
  console.log(`   Dry run:    ${DRY_RUN}`)
  console.log(`   Started at: ${stats.startedAt.toISOString()}\n`)

  // Record run in DB
  if (!DRY_RUN) {
    await sql`
      INSERT INTO crawl_stats (run_id, status) VALUES (${stats.runId}, 'running')
    `.catch(() => {}) // Non-fatal
  }

  const visited = new Set<string>()
  const queue: QueueItem[] = SEED_URLS.map(url => ({ url, depth: 0, parentUrl: '' }))
  const documentQueue: string[] = []

  // BFS crawl with concurrency
  while (queue.length > 0 && stats.pagesCrawled < MAX_PAGES) {
    // Take up to CONCURRENCY items at once
    const batch = queue.splice(0, CONCURRENCY)

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        if (visited.has(item.url)) return null
        visited.add(item.url)

        // Rate limiting
        await new Promise(r => setTimeout(r, REQUEST_DELAY_MS))

        if (isDocumentUrl(item.url)) {
          documentQueue.push(item.url)
          return null
        }

        console.log(`📄 [${stats.pagesCrawled + 1}/${MAX_PAGES}] ${item.url}`)
        const result = await processPage(item.url)
        stats.pagesCrawled++

        if (result.status === 'success') {
          // Enqueue discovered links
          const links = (result as any).links as string[] | undefined
          if (links) {
            for (const link of links) {
              if (!visited.has(link) && isAllowedUrl(link)) {
                if (isDocumentUrl(link)) {
                  documentQueue.push(link)
                } else if (item.depth < 10) { // Max depth guard
                  queue.push({ url: link, depth: item.depth + 1, parentUrl: item.url })
                }
              }
            }
          }
          console.log(`  ✅ ${result.chunksCreated} chunks | ${result.title?.slice(0, 50)}`)
        } else if (result.status === 'skipped') {
          stats.pagesSkipped++
          console.log(`  ⏭️  Skipped: ${result.error}`)
        } else {
          stats.pagesFailed++
          console.log(`  ❌ Failed: ${result.error}`)
          if (!DRY_RUN) {
            await sql`
              INSERT INTO crawl_failed_pages (run_id, url, error)
              VALUES (${stats.runId}, ${item.url}, ${result.error})
            `.catch(() => {})
          }
        }

        return result
      })
    )
  }

  // ── Process discovered documents ───────────────────────────────────────────
  if (documentQueue.length > 0) {
    console.log(`\n📎 Processing ${documentQueue.length} discovered documents...`)
    for (const docUrl of documentQueue) {
      if (!DRY_RUN) {
        try {
          console.log(`  📄 ${docUrl}`)
          const docResult = await processDocument(docUrl)
          if (docResult.success) {
            stats.documentsProcessed++
            stats.chunksCreated += docResult.chunksCreated
            console.log(`  ✅ ${docResult.chunksCreated} chunks from document`)
          } else {
            console.log(`  ❌ Document failed: ${docResult.error}`)
          }
        } catch (err: any) {
          console.log(`  ❌ Document error: ${err.message}`)
        }
      } else {
        console.log(`  [DRY RUN] Would process document: ${docUrl}`)
        stats.documentsProcessed++
      }
    }
  }

  // ── Finalize ───────────────────────────────────────────────────────────────
  const durationSeconds = Math.round((Date.now() - stats.startedAt.getTime()) / 1000)

  if (!DRY_RUN) {
    await sql`
      UPDATE crawl_stats SET
        pages_crawled       = ${stats.pagesCrawled},
        pages_failed        = ${stats.pagesFailed},
        pages_updated       = ${stats.pagesUpdated},
        pages_skipped       = ${stats.pagesSkipped},
        documents_processed = ${stats.documentsProcessed},
        chunks_created      = ${stats.chunksCreated},
        embeddings_created  = ${stats.embeddingsCreated},
        duration_seconds    = ${durationSeconds},
        status              = 'completed',
        completed_at        = CURRENT_TIMESTAMP
      WHERE run_id = ${stats.runId}
    `.catch(() => {})
  }

  console.log(`\n✅ Crawl Complete!`)
  console.log(`   Pages crawled:      ${stats.pagesCrawled}`)
  console.log(`   Pages updated:      ${stats.pagesUpdated}`)
  console.log(`   Pages skipped:      ${stats.pagesSkipped}`)
  console.log(`   Pages failed:       ${stats.pagesFailed}`)
  console.log(`   Documents:          ${stats.documentsProcessed}`)
  console.log(`   Chunks created:     ${stats.chunksCreated}`)
  console.log(`   Duration:           ${durationSeconds}s`)
  console.log(`   Run ID:             ${stats.runId}`)
}

runCrawler().catch(async (error) => {
  console.error('💥 Crawler crashed:', error)
  await sql`
    UPDATE crawl_stats SET status = 'failed', error_log = ${error.message}, completed_at = CURRENT_TIMESTAMP
    WHERE run_id = ${stats.runId}
  `.catch(() => {})
  process.exit(1)
})
