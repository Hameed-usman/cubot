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
      return "CONTEXT: This person is likely a prospective student or their parent exploring admission. They are in decision-making mode. After answering, gently guide them toward the next concrete step: checking eligibility, visiting campus, or submitting an application. Mention the application deadline if known.";
    case 'fee_inquiry':
      return "CONTEXT: This person is weighing affordability. They may be comparing us with other universities. After sharing the fee, mention any installment plan options and scholarship opportunities available — even if they didn't ask. This proactively removes a common barrier.";
    case 'scholarship_inquiry':
      return "CONTEXT: This person may have financial concerns. Be especially warm and encouraging. Mention all available scholarship types (merit, need-based, sports, etc.) and tell them exactly what documents they need. Motivate them — a scholarship question often means a serious candidate who just needs confidence.";
    case 'program_inquiry':
      return "CONTEXT: This person is exploring options — they may not have decided yet. Give them a clear overview, then ask a soft question to understand their interest area better (e.g., 'Are you more drawn to the technical side or management?'). This helps narrow down the best program for them.";
    case 'career_inquiry':
      return "CONTEXT: This person wants to know if this degree is worth it. Share placement outcomes, industry partnerships, or notable alumni if available. Be honest and confident. End with something forward-looking that connects their ambition to what the university offers.";
    case 'faculty_hiring':
      return "CONTEXT: This person is a professional exploring a teaching or research role. Treat them with high respect — they are a potential colleague. Share the hiring process clearly, mention what makes the university a great place to work, and guide them toward where to submit an application.";
    case 'hostel_inquiry':
      return "CONTEXT: This person is likely from another city or considering relocating. Address both practical concerns (cost, facilities, safety) and comfort concerns (environment, food, transport). A welcoming tone here can be the deciding factor for out-of-city students.";
    case 'contact_inquiry':
      return "CONTEXT: This person wants to visit or reach out directly. Give the full contact info warmly and add a personal nudge: 'The admissions team is very helpful — they can walk you through everything in a single call.' If a campus visit is possible, encourage it.";
    case 'general_question':
    default:
      return "CONTEXT: Answer naturally and helpfully. If the question seems unrelated to the university, gently redirect with warmth.";
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
