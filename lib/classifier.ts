import { Classification, PageType } from '@/types'

/**
 * Automatic page classifier.
 * Classifies a page into a PageType and category based on URL patterns and title keywords.
 * No AI cost — purely rule-based for maximum performance.
 */

interface ClassificationRule {
  pattern: RegExp
  pageType: PageType
  category: string
  department: string
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  // Alumni
  { pattern: /alumni/i, pageType: 'alumni', category: 'Alumni', department: 'general' },

  // Admissions
  { pattern: /admiss?ions?|apply|application|enroll|register/i, pageType: 'admissions', category: 'Admissions', department: 'general' },

  // Scholarships
  { pattern: /scholarship|financial.?aid|bursary|stipend|merit/i, pageType: 'scholarship', category: 'Scholarship', department: 'general' },

  // Notices & News
  { pattern: /notice|announcement|news|circular|bulletin|press.?release/i, pageType: 'notice', category: 'Notice', department: 'general' },

  // Events
  { pattern: /event|seminar|workshop|conference|ceremony|convocation|webinar/i, pageType: 'event', category: 'Events', department: 'general' },

  // Faculty & Staff
  { pattern: /faculty|staff|professor|lecturer|instructor|dean|rector|director/i, pageType: 'faculty', category: 'Faculty', department: 'general' },

  // Policies & Regulations
  { pattern: /policy|policies|rule|regulation|handbook|bylaw|procedure|code.?of.?conduct/i, pageType: 'policy', category: 'Policy', department: 'general' },

  // Finance / Fees
  { pattern: /fee|tuition|charges?|payment|finance|cost|dues|prospectus/i, pageType: 'academic', category: 'Finance', department: 'general' },

  // Contact
  { pattern: /contact|location|address|map|phone|email|reach.?us/i, pageType: 'contact', category: 'Contact', department: 'general' },

  // Departments — CS & IT
  { pattern: /\b(cs|cse|it|software.?eng|computer.?science|information.?technology|bscs|bsit|bsse)\b/i, pageType: 'department', category: 'CS & IT', department: 'cs_it' },

  // Departments — BBA / Business
  { pattern: /\b(bba|mba|business.?admin|management|commerce|bs.?business)\b/i, pageType: 'department', category: 'BBA', department: 'bba' },

  // Departments — Pharmacy
  { pattern: /pharm(acy|acology|d)|d\.pharm/i, pageType: 'department', category: 'Pharmacy', department: 'pharmacy' },

  // Departments — Nursing
  { pattern: /nurs(ing|e)|midwifery|bs.?nursing/i, pageType: 'department', category: 'Nursing', department: 'nursing' },

  // Academic — general
  { pattern: /academic|curriculum|course|syllabus|semester|timetable|schedule|credit|degree|program/i, pageType: 'academic', category: 'Academic', department: 'general' },
]

/**
 * Classifies a page using its URL and title.
 * Returns the first matching rule (rules ordered by specificity).
 */
export function classifyPage(url: string, title: string): Classification {
  const combined = `${url} ${title}`.toLowerCase()

  // High-priority check for Faculty/Staff (including profile.php and bio pages)
  if (
    url.includes('profile.php') || 
    url.includes('faculty') || 
    url.includes('teacher') ||
    /faculty|staff|professor|lecturer|instructor|dean|rector|director|bio|cv|resume|teacher|scholar|scientist|educator/i.test(combined)
  ) {
    let department = 'general'
    if (/\b(cs|cse|it|software.?eng|computer.?science|information.?technology|bscs|bsit|bsse)\b/i.test(combined)) {
      department = 'cs_it'
    } else if (/\b(bba|mba|business.?admin|management|commerce|bs.?business)\b/i.test(combined)) {
      department = 'bba'
    } else if (/pharm(acy|acology|d)|d\.pharm/i.test(combined)) {
      department = 'pharmacy'
    } else if (/nurs(ing|e)|midwifery|bs.?nursing/i.test(combined)) {
      department = 'nursing'
    }

    // Ensure it's marked as Faculty if it's a profile or has strong keywords
    const isStrongProfileMatch = url.includes('profile.php') || /professor|lecturer|instructor|dean/i.test(combined);
    
    if (isStrongProfileMatch) {
      return {
        pageType: 'faculty',
        category: 'Faculty',
        department,
      }
    }
  }

  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(combined)) {
      return {
        pageType: rule.pageType,
        category: rule.category,
        department: rule.department,
      }
    }
  }

  // Default fallback
  return {
    pageType: 'general',
    category: 'General',
    department: 'general',
  }
}

/**
 * Build a human-readable breadcrumb from a URL path.
 * e.g., '/admissions/undergraduate/fees' → 'Admissions > Undergraduate > Fees'
 */
export function buildBreadcrumb(url: string): string {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map(seg =>
        seg
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
          .replace(/\.(html?|php|aspx?)$/i, '')
      )
    return segments.length > 0 ? `Home > ${segments.join(' > ')}` : 'Home'
  } catch {
    return 'Home'
  }
}
