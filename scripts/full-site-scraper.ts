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

const BASE_URL = 'https://cusit.edu.pk'
const ALLOWED_DOMAINS = ['cusit.edu.pk', 'www.cusit.edu.pk']
const MAX_PAGES = parseInt(process.env.CRAWLER_MAX_PAGES || '2500')
const CONCURRENCY = parseInt(process.env.CRAWLER_CONCURRENCY || '4')
const REQUEST_DELAY_MS = parseInt(process.env.CRAWLER_DELAY_MS || '900')
const DRY_RUN = process.env.DRY_RUN === 'true'
const INCREMENTAL = process.env.INCREMENTAL !== 'false' // Default: incremental ON

const DENY_PATTERNS = [
  /\.(jpg|jpeg|png|gif|svg|ico|css|js|woff|woff2|ttf|eot|mp4|mp3|avi|zip|rar|tar|gz)(\?.*)?$/i,
  /\/(wp-admin|wp-login|wp-cron|feed|rss|sitemap\.xml|robots\.txt)/i,
  /\/(login|logout|register|cart|checkout|account)/i,
  /(facebook|twitter|youtube|linkedin|instagram|whatsapp)\.com/i,
  /mailto:|tel:|javascript:|#$/i,
]

const DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.doc', '.pptx', '.ppt']

// ─── Priority URLs ─────────────────────────────────────────────────────────────

/**
 * High-priority: faculty profiles, admissions pages, fee structures.
 * These are crawled FIRST before generic pages are discovered.
 */
const SEED_URLS: Array<{ url: string; priority: number }> = [
  // Priority 1 — Core institutional pages
  { url: 'https://cusit.edu.pk', priority: 1 },
  { url: 'https://cusit.edu.pk/admissions.php', priority: 1 },
  { url: 'https://cusit.edu.pk/fee-structure.php', priority: 1 },
  { url: 'https://cusit.edu.pk/scholarships.php', priority: 1 },
  { url: 'https://cusit.edu.pk/contact.php', priority: 1 },

  // Priority 2 — Faculty lists (each leads to profile pages)
  { url: 'https://cusit.edu.pk/cusitnew/cs/faculty.php', priority: 2 },
  { url: 'https://cusit.edu.pk/cusitnew/se/faculty.php', priority: 2 },
  { url: 'https://cusit.edu.pk/cusitnew/bba/faculty.php', priority: 2 },
  { url: 'https://cusit.edu.pk/cusitnew/pharmacy/faculty.php', priority: 2 },
  { url: 'https://cusit.edu.pk/cusitnew/nursing/faculty.php', priority: 2 },
  { url: 'https://cusit.edu.pk/cusitnew/civil/faculty.php', priority: 2 },
  { url: 'https://cusit.edu.pk/cusitnew/electrical/faculty.php', priority: 2 },

  // Priority 3 — Programs
  { url: 'https://cusit.edu.pk/cusitnew/cs/programs.php', priority: 3 },
  { url: 'https://cusit.edu.pk/cusitnew/se/programs.php', priority: 3 },
  { url: 'https://cusit.edu.pk/cusitnew/bba/programs.php', priority: 3 },
  { url: 'https://cusit.edu.pk/cusitnew/pharmacy/programs.php', priority: 3 },
  { url: 'https://cusit.edu.pk/cusitnew/nursing/programs.php', priority: 3 },
]

// ─── Types ─────────────────────────────────────────────────────────────────────

interface QueueItem {
  url: string
  depth: number
  parentUrl: string
  priority: number // Lower = higher priority
}

interface PageResult {
  url: string
  title: string
  content: string
  status: 'success' | 'skipped' | 'failed'
  chunksCreated?: number
  error?: string
  links?: string[]
}

// ─── Crawl Stats ───────────────────────────────────────────────────────────────

const stats = {
  runId: uuidv4(),
  pagesCrawled: 0,
  pagesFailed: 0,
  pagesUpdated: 0,
  pagesSkipped: 0,
  pagesUnchanged: 0,
  documentsProcessed: 0,
  chunksCreated: 0,
  embeddingsCreated: 0,
  startedAt: new Date(),
}

// ─── Robots.txt Parser ─────────────────────────────────────────────────────────

let robotsDisallowed: RegExp[] = []

async function loadRobotsTxt(baseUrl: string): Promise<void> {
  try {
    const resp = await fetch(`${baseUrl}/robots.txt`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) return

    const text = await resp.text()
    const disallowed: string[] = []
    let isOurAgent = false

    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (/^user-agent:\s*\*/i.test(trimmed) || /^user-agent:\s*CubotCrawler/i.test(trimmed)) {
        isOurAgent = true
      } else if (/^user-agent:/i.test(trimmed)) {
        isOurAgent = false
      } else if (isOurAgent && /^disallow:/i.test(trimmed)) {
        const rule = trimmed.replace(/^disallow:\s*/i, '').trim()
        if (rule) disallowed.push(rule)
      }
    }

    robotsDisallowed = disallowed.map(r => {
      const escaped = r.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
      return new RegExp(escaped)
    })

    console.log(`🤖 Robots.txt: ${disallowed.length} disallow rules loaded`)
  } catch {
    console.log('⚠️  Could not load robots.txt — proceeding without it')
  }
}

function isRobotsBlocked(url: string): boolean {
  try {
    const parsed = new URL(url)
    const pathAndQuery = parsed.pathname + parsed.search
    return robotsDisallowed.some(r => r.test(pathAndQuery))
  } catch {
    return false
  }
}

// ─── URL Utilities ─────────────────────────────────────────────────────────────

/**
 * Canonical URL normalization:
 * - Remove fragments
 * - Remove tracking params (utm_*, ref, etc.)
 * - Normalize trailing slash (remove it)
 * - Lowercase hostname
 */
function normalizeUrl(url: string, base: string): string | null {
  try {
    const resolved = new URL(url, base)
    resolved.hash = ''

    // Remove tracking & session params
    const removeParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'ref', 'referrer', 'fbclid', 'gclid', 'sessionid', 'session_id',
      '_ga', 'mc_cid', 'mc_eid',
    ]
    removeParams.forEach(p => resolved.searchParams.delete(p))

    // Normalize trailing slash on path (except root)
    if (resolved.pathname.endsWith('/') && resolved.pathname.length > 1) {
      resolved.pathname = resolved.pathname.slice(0, -1)
    }

    resolved.hostname = resolved.hostname.toLowerCase()
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
    if (isRobotsBlocked(url)) return false
    return true
  } catch {
    return false
  }
}

function isDocumentUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return DOCUMENT_EXTENSIONS.some(ext => lower.includes(ext))
}

// ─── Incremental Change Detection ─────────────────────────────────────────────

/**
 * Fetches page with HTTP conditional request (If-Modified-Since).
 * If server returns 304 Not Modified, we skip re-processing entirely.
 * Saves embedding costs for unchanged pages.
 */
async function fetchPageWithChangeDetection(
  url: string,
  lastScrapedAt?: string
): Promise<{ html: string; status: 'changed' | 'unchanged' | 'failed'; error?: string }> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; CubotCrawler/1.0; +https://cusit.edu.pk/cubot)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache',
  }

  // Add conditional request header for incremental crawling
  if (INCREMENTAL && lastScrapedAt) {
    headers['If-Modified-Since'] = new Date(lastScrapedAt).toUTCString()
  }

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(20000),
    })

    // 304 = page unchanged since last crawl
    if (response.status === 304) {
      return { html: '', status: 'unchanged' }
    }

    if (!response.ok) {
      return { html: '', status: 'failed', error: `HTTP ${response.status}` }
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      return { html: '', status: 'failed', error: 'Non-HTML content' }
    }

    const html = await response.text()
    return { html, status: 'changed' }
  } catch (error: any) {
    return { html: '', status: 'failed', error: error.message || 'Fetch error' }
  }
}

// ─── Previously Scraped URL Lookup ────────────────────────────────────────────

async function getLastScrapedAt(url: string): Promise<string | null> {
  try {
    const rows = await sql`
      SELECT MAX(last_scraped_at) as last_scraped
      FROM knowledge_entries
      WHERE source_url = ${url}
        AND last_scraped_at IS NOT NULL
    `
    return rows[0]?.last_scraped?.toISOString() || null
  } catch {
    return null
  }
}

// ─── Content Extraction ────────────────────────────────────────────────────────

/**
 * Enhanced content extractor with CUSIT-specific selectors and
 * aggressive boilerplate removal.
 */
async function extractContent(
  html: string,
  url: string
): Promise<{ title: string; content: string; links: string[] }> {
  const cheerio = await import('cheerio')
  const $ = cheerio.load(html)

  // 1. Extract links BEFORE removing any DOM elements
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
    return extractFacultyProfile($, url, links)
  }

  // ── Remove ALL boilerplate elements ──────────────────────────────────────
  $(
    // Standard boilerplate
    'script, style, noscript, iframe, object, embed, ' +
    'nav, header, footer, aside, ' +
    // CSS class-based
    '.nav, .navbar, .navigation, .menu, .header, .footer, .sidebar, ' +
    '.cookie-banner, .cookie-notice, .popup, .modal, .overlay, ' +
    '.social-share, .social-links, .share-buttons, ' +
    '.breadcrumb-nav, .pagination, .pager, ' +
    '.wp-caption, .gallery, .related-posts, .post-navigation, ' +
    // CUSIT-specific boilerplate selectors
    '.site-header, .site-footer, .topbar, .bottom-bar, ' +
    '.cusitnew-nav, #topnav, .main-nav, .footer-bottom, ' +
    '.scroll-top, .back-to-top, .floating-btn, ' +
    // ID-based
    '#nav, #header, #footer, #sidebar, #menu, ' +
    '#topbar, #top-bar, #bottom-bar, ' +
    // ARIA roles
    '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
    '[role="complementary"]'
  ).remove()

  // Also remove elements with these common text patterns (social links etc.)
  $('a').filter((_, el) => {
    const href = $(el).attr('href') || ''
    return /facebook|twitter|youtube|linkedin|instagram|whatsapp/i.test(href)
  }).closest('div, ul, li').remove()

  // ── Extract title ────────────────────────────────────────────────────────
  const title = (
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    'Untitled Page'
  ).replace(/\s+/g, ' ').replace(/[-|] CUSIT.*$/i, '').trim().slice(0, 200)

  // ── Try semantic content containers ──────────────────────────────────────
  const contentSelectors = [
    'main', 'article', '[role="main"]',
    '#content', '#main-content', '#page-content',
    '.content', '.main-content', '.entry-content', '.post-content',
    '.page-content', '.article-content',
    // CUSIT-specific
    '.cusitnew-content', '.department-content', '.about-content',
    '#main', '.container > .row',
  ]

  let contentEl: any = $('body')
  for (const sel of contentSelectors) {
    if ($(sel).length > 0) {
      contentEl = $(sel).first()
      break
    }
  }

  // ── Extract structured text ───────────────────────────────────────────────
  const textParts: string[] = []
  const seenTexts = new Set<string>() // Prevent duplicate paragraphs

  contentEl.find('h1, h2, h3, h4, p, li, td, th, dt, dd, blockquote').each((_: any, el: any) => {
    const tag = (el as any).tagName?.toLowerCase() || ''
    const text = $(el).text().replace(/\s+/g, ' ').trim()

    if (text.length < 10) return // Skip trivially short elements
    if (seenTexts.has(text)) return // Skip duplicate text
    seenTexts.add(text)

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

/**
 * Structured extractor for faculty profile pages.
 * Returns clean markdown with name, designation, department, email, and sections.
 */
function extractFacultyProfile(
  $: any,
  url: string,
  links: string[]
): { title: string; content: string; links: string[] } {
  const name = $('h4.color-white, h4, .profile-name, .name').first().text().trim() ||
    $('title').text().split('|')[0].replace(/profile/i, '').replace(/cusit/i, '').replace(/[-|:]/g, '').trim() ||
    'Faculty Member'

  let designation = ''
  let email = ''
  let phone = ''
  let department = ''

  // Look for key-value info in tables or definition lists
  $('body').find('tr, p, div').each((_: any, el: any) => {
    const txt = $(el).text().replace(/\s+/g, ' ').trim()
    const lower = txt.toLowerCase()

    if (!email && lower.includes('@')) {
      const match = txt.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/)
      if (match) email = match[0]
    }
    if (!designation && (lower.includes('designation') || /lecturer|professor|assistant|associate|instructor/i.test(txt))) {
      designation = txt.replace(/designation:?/i, '').trim().slice(0, 100)
    }
    if (!department && (lower.includes('department') || /faculty of|dept/i.test(txt))) {
      department = txt.replace(/department:?|dept:?/i, '').trim().slice(0, 100)
    }
    if (!phone && (lower.includes('phone') || lower.includes('cell') || lower.includes('contact'))) {
      const phoneMatch = txt.match(/[\d+-]{7,}/)
      if (phoneMatch) phone = phoneMatch[0]
    }
  })

  const sections: Array<{ title: string; content: string }> = []
  
  // Scrape research/education sections
  $('h1, h2, h3, h4, h5, h6, strong, b').each((_: any, el: any) => {
    const headingText = $(el).text().trim()
    if (!headingText || headingText.length < 3 || headingText.length > 50) return

    if (/qualification|education|experience|research|publication|specialization|interest|achievement/i.test(headingText)) {
      const contentParts: string[] = []
      let next = $(el).parent().next(); // Try checking siblings from parent if nested
      if (next.length === 0) next = $(el).next();
      
      let limit = 8;
      while (next.length > 0 && limit-- > 0) {
        if (/h[1-6]/i.test(next[0].name)) break;
        const text = next.text().replace(/\s+/g, ' ').trim()
        if (text.length > 5) contentParts.push(text)
        next = next.next()
      }
      
      if (contentParts.length > 0) {
        sections.push({ title: headingText, content: contentParts.join('\n') })
      }
    }
  })

  const mdParts = [
    `# Teacher Profile: ${name}`,
    designation ? `- **Designation**: ${designation}` : '',
    department ? `- **Department**: ${department}` : '',
    email ? `- **Email**: ${email}` : '',
    phone ? `- **Phone**: ${phone}` : '',
    `- **Official Profile**: ${url}`,
    '',
  ].filter(Boolean)

  sections.forEach(sec => {
    mdParts.push(`## ${sec.title}`)
    mdParts.push(sec.content)
    mdParts.push('')
  })

  return {
    title: `Teacher: ${name}`,
    content: mdParts.join('\n').trim(),
    links,
  }
}

// ─── Duplicate Content Detection ───────────────────────────────────────────────

/**
 * Checks if content is substantially similar to already-processed pages.
 * Uses a fast character-level shingle comparison.
 * Prevents re-embedding near-identical pages (e.g., paginated lists).
 */
const processedContentHashes = new Set<string>()

function isNearDuplicate(content: string): boolean {
  const fingerprint = crypto
    .createHash('md5')
    .update(content.slice(0, 1000).toLowerCase().replace(/\s+/g, ' '))
    .digest('hex')
    .slice(0, 16)

  if (processedContentHashes.has(fingerprint)) return true
  processedContentHashes.add(fingerprint)
  return false
}

// ─── Page Processor ────────────────────────────────────────────────────────────

async function processPage(url: string): Promise<PageResult> {
  try {
    // Check if we've seen this page before (for incremental crawling)
    const lastScrapedAt = INCREMENTAL ? await getLastScrapedAt(url) : null

    const { html, status, error } = await fetchPageWithChangeDetection(url, lastScrapedAt ?? undefined)

    if (status === 'unchanged') {
      stats.pagesUnchanged++
      return { url, title: '', content: '', status: 'skipped', error: 'Unchanged (304/hash match)' }
    }

    if (status === 'failed') {
      return { url, title: '', content: '', status: 'failed', error }
    }

    if (html.length < 200) {
      return { url, title: '', content: '', status: 'skipped', error: 'Insufficient HTML (may need JS rendering)' }
    }

    const { title, content, links } = await extractContent(html, url)

    if (content.length < 50) {
      return { url, title, content, status: 'skipped', error: 'Insufficient content after extraction' }
    }

    // Near-duplicate check (skip pages with very similar content)
    if (isNearDuplicate(content)) {
      return { url, title, content, status: 'skipped', error: 'Near-duplicate content detected' }
    }

    const contentHash = crypto.createHash('md5').update(content).digest('hex')
    const classification = classifyPage(url, title, content.slice(0, 1000))
    const breadcrumb = buildBreadcrumb(url)
    const parentPageId = uuidv4()

    // Semantic chunking with keyword extraction
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
        chunks: chunks.map(c => ({
          text: c.text,
          chunkIndex: c.metadata.chunkIndex,
          keywords: (c.metadata as any).keywords || [],
          sectionName: (c.metadata as any).sectionName || '',
        })),
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

    return { url, title, content, status: 'success', chunksCreated: chunks.length, links }
  } catch (error: any) {
    return { url, title: '', content: '', status: 'failed', error: error.message }
  }
}

// ─── Main Crawler ──────────────────────────────────────────────────────────────

async function runCrawler() {
  console.log(`\n🤖 Cubot Enterprise Crawler Worker`)
  console.log(`   Polling crawl_queue...`)
  console.log(`   Max pages/session: ${MAX_PAGES}`)
  console.log(`   Concurrency: ${CONCURRENCY}`)

  // Load robots.txt before crawling
  await loadRobotsTxt(BASE_URL)

  // ── Insert a crawl_runs row so the observability dashboard tracks this run ──
  try {
    await sql`
      INSERT INTO crawl_runs (id, status, started_at)
      VALUES (${stats.runId}, 'running', ${stats.startedAt.toISOString()})
    `
    console.log(`📋 Crawl run registered: ${stats.runId}`)
  } catch (e: any) {
    console.warn(`⚠️  Could not register crawl run (non-fatal): ${e.message}`)
  }

  let idleCount = 0;

  while (true) {
    // Check for paused status — always use our own run ID
    const activeRuns = await sql`SELECT id, status FROM crawl_runs WHERE id = ${stats.runId} LIMIT 1`.catch(()=>[])
    if (activeRuns.length > 0 && activeRuns[0].status === 'paused') {
      console.log('⏸️  Crawl paused. Waiting...')
      await new Promise(r => setTimeout(r, 10000))
      continue
    }

    // Get next URL
    const nextItems = await sql`
      UPDATE crawl_queue
      SET status = 'processing', updated_at = CURRENT_TIMESTAMP
      WHERE id = (
        SELECT id FROM crawl_queue
        WHERE status = 'pending'
        ORDER BY priority ASC, created_at ASC
        LIMIT 1
      )
      RETURNING *
    `.catch(()=>[])

    if (!nextItems || nextItems.length === 0) {
      idleCount++
      if (idleCount % 12 === 0) {
        console.log(`💤 Queue empty, waiting...`)
      }
      await new Promise(r => setTimeout(r, 5000))
      continue
    }

    idleCount = 0
    const item = nextItems[0]
    console.log(`📄 [Depth: ${item.depth}] ${item.url}`)

    const result = await processPage(item.url)

    // Add links to queue if successful
    if (result.status === 'success') {
      const links = result.links || []
      for (const link of links) {
        if (isAllowedUrl(link)) {
          const isProfile = link.includes('profile.php') || link.includes('faculty/') || link.includes('staff/')
          const linkPriority = isProfile ? 1
            : link.includes('admiss') || link.includes('fee') ? 2
            : item.priority + 1
            
          await sql`
            INSERT INTO crawl_queue (url, depth, priority)
            VALUES (${link}, ${item.depth + 1}, ${linkPriority})
            ON CONFLICT (url) DO NOTHING
          `.catch(()=>{})
        }
      }
      await sql`UPDATE crawl_queue SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ${item.id}`.catch(()=>{})
      
      // Update stats
      if (activeRuns.length > 0) {
         await sql`UPDATE crawl_runs SET pages_crawled = pages_crawled + 1, chunks_created = chunks_created + ${result.chunksCreated || 0} WHERE id = ${activeRuns[0].id}`.catch(()=>{})
      }
    } else if (result.status === 'skipped') {
      await sql`UPDATE crawl_queue SET status = 'completed', error = ${result.error || 'skipped'}, updated_at = CURRENT_TIMESTAMP WHERE id = ${item.id}`.catch(()=>{})
      if (activeRuns.length > 0) {
         await sql`UPDATE crawl_runs SET pages_skipped = pages_skipped + 1 WHERE id = ${activeRuns[0].id}`.catch(()=>{})
      }
    } else {
      await sql`UPDATE crawl_queue SET status = 'failed', error = ${result.error || 'failed'}, updated_at = CURRENT_TIMESTAMP WHERE id = ${item.id}`.catch(()=>{})
      
      // log to failed_urls
      const activeRun = activeRuns.length > 0 ? activeRuns[0].id : null
      let category = 'other'
      if (result.error?.includes('404')) category = '404'
      else if (result.error?.includes('timeout')) category = 'timeout'
      
      await sql`
        INSERT INTO failed_urls (run_id, url, error_category, error_details)
        VALUES (${activeRun}, ${item.url}, ${category}, ${result.error})
      `.catch(()=>{})
      
      if (activeRuns.length > 0) {
         await sql`UPDATE crawl_runs SET pages_failed = pages_failed + 1 WHERE id = ${activeRuns[0].id}`.catch(()=>{})
      }
    }
    
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS))
  }
}

// ─── Export for programmatic use ─────────────────────────────────────────────
export { runCrawler }

// Only run automatically if executed directly via tsx/node
if (require.main === module) {
  runCrawler().catch(async (error) => {
    console.error('💥 Crawler crashed:', error)
    await sql`
      UPDATE crawl_stats SET status = 'failed', error_log = ${error.message}, completed_at = CURRENT_TIMESTAMP
      WHERE run_id = ${stats.runId}
    `.catch(() => {})
    process.exit(1)
  })
}
