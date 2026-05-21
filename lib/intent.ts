export type Intent =
  | 'admission_inquiry'
  | 'fee_inquiry'
  | 'scholarship_inquiry'
  | 'program_inquiry'
  | 'career_inquiry'
  | 'faculty_hiring'
  | 'hostel_inquiry'
  | 'contact_inquiry'
  | 'general_question';

export function classifyIntent(message: string): Intent {
  const lowerMsg = message.toLowerCase();

  const intents: { type: Intent; keywords: string[] }[] = [
    { type: 'admission_inquiry', keywords: ['admit', 'admission', 'apply', 'application', 'enroll', 'entry test', 'eligibility', 'requirements', 'form', 'last date'] },
    { type: 'fee_inquiry', keywords: ['fee', 'fees', 'cost', 'charges', 'tuition', 'payment', 'installment', 'how much', 'price'] },
    { type: 'scholarship_inquiry', keywords: ['scholarship', 'financial aid', 'merit', 'stipend', 'bursary', 'discount', 'waiver', 'free'] },
    { type: 'program_inquiry', keywords: ['program', 'degree', 'course', 'department', 'bachelor', 'master', 'bs', 'bsc', 'ms', 'msc', 'phd', 'what do you offer'] },
    { type: 'career_inquiry', keywords: ['job', 'career', 'placement', 'employment', 'salary', 'after graduation', 'industry'] },
    { type: 'faculty_hiring', keywords: ['teach', 'lecturer', 'professor', 'faculty', 'vacancy', 'hiring', 'job opening', 'join as teacher'] },
    { type: 'hostel_inquiry', keywords: ['hostel', 'accommodation', 'dorm', 'dormitory', 'living', 'room', 'stay', 'residential'] },
    { type: 'contact_inquiry', keywords: ['contact', 'phone', 'email', 'address', 'location', 'where', 'visit', 'find you', 'directions', 'map'] }
  ];

  for (const intent of intents) {
    if (intent.keywords.some(kw => lowerMsg.includes(kw))) {
      return intent.type;
    }
  }

  return 'general_question';
}

export function getIntentContext(intent: Intent): string {
  switch (intent) {
    case 'admission_inquiry':
      return "INTENT: Admission query. Give concrete steps, eligibility, and deadlines if known. After answering, nudge toward the next action (apply, check eligibility, visit campus).";
    case 'fee_inquiry':
      return "INTENT: Fee query — likely comparing options. Share the fee structure directly. Proactively mention installment plans and scholarships if relevant, even if not asked.";
    case 'scholarship_inquiry':
      return "INTENT: Scholarship query — may have financial concerns. Cover all available types (merit, need-based, sports). Mention required documents and deadlines. Be encouraging but factual.";
    case 'program_inquiry':
      return "INTENT: Program exploration — user may be undecided. Give a clear overview of the program(s), then ask a narrowing question to help them decide.";
    case 'career_inquiry':
      return "INTENT: Career/ROI question. Share placement outcomes, industry links, or notable alumni if available. Be honest and forward-looking.";
    case 'faculty_hiring':
      return "INTENT: Professional exploring a teaching role. Share the hiring process clearly, mention what makes the university appealing, guide toward application submission.";
    case 'hostel_inquiry':
      return "INTENT: Likely from another city. Cover cost, facilities, safety, and transport. Practical details matter most here.";
    case 'contact_inquiry':
      return "INTENT: Wants to reach out or visit. Give full contact info and encourage a campus visit or direct call if appropriate.";
    case 'general_question':
    default:
      return "INTENT: General query. Answer naturally. If unrelated to the university, redirect briefly without being dismissive.";
  }
}

export function getIntentSuggestions(intent: Intent): string[] {
  switch (intent) {
    case 'admission_inquiry':
      return ["What documents do I need to apply?", "When is the next intake?", "Is there an entry test?"];
    case 'fee_inquiry':
      return ["Are installment plans available?", "What scholarships can reduce the fee?", "How does the fee compare to other universities?"];
    case 'scholarship_inquiry':
      return ["What is the merit scholarship criteria?", "Can I apply for multiple scholarships?", "What is the last date to apply?"];
    case 'program_inquiry':
      return ["What is the career scope of this program?", "Who are the faculty members?", "What makes this program unique?"];
    case 'career_inquiry':
      return ["Do you have industry partnerships?", "What is the average salary after graduation?", "Are internships part of the program?"];
    case 'faculty_hiring':
      return ["What are the eligibility requirements?", "How do I submit my CV?", "What benefits do faculty members receive?"];
    case 'hostel_inquiry':
      return ["What is the monthly hostel fee?", "Is the hostel co-educational or separate?", "What transport is available from campus?"];
    case 'contact_inquiry':
      return ["Can I schedule a campus visit?", "What are the office hours?", "Is there an online application form?"];
    case 'general_question':
    default:
      return ["Tell me about admission requirements", "What programs are available?", "How can I contact the university?"];
  }
}
