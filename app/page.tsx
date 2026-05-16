import Link from 'next/link'
import { MessageCircle, GraduationCap, BookOpen, Phone } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-cu-blue py-20 px-4">
        <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-10" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="mb-6">
            <span className="inline-block px-4 py-2 bg-cu-gold/20 text-cu-gold rounded-full text-sm font-medium">
              Official AI Assistant
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Meet <span className="text-cu-gold">Cubot</span>
          </h1>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Your intelligent assistant for City University Peshawar. Get instant
            answers about admissions, courses, fees, and more.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-8 py-4 bg-cu-gold text-cu-dark font-semibold rounded-lg hover:bg-cu-gold/90 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            Start Chatting
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-cu-dark text-center mb-12">
            How Cubot Helps You
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="w-12 h-12 bg-cu-blue/10 rounded-lg flex items-center justify-center mb-4">
                <GraduationCap className="w-6 h-6 text-cu-blue" />
              </div>
              <h3 className="text-lg font-semibold text-cu-dark mb-2">
                Admissions
              </h3>
              <p className="text-slate-600 text-sm">
                Get detailed information about admission requirements, eligibility,
                and application deadlines.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="w-12 h-12 bg-cu-blue/10 rounded-lg flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-cu-blue" />
              </div>
              <h3 className="text-lg font-semibold text-cu-dark mb-2">
                Courses & Programs
              </h3>
              <p className="text-slate-600 text-sm">
                Explore course structures, semester plans, and curriculum details
                across all departments.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="w-12 h-12 bg-cu-blue/10 rounded-lg flex items-center justify-center mb-4">
                <Phone className="w-6 h-6 text-cu-blue" />
              </div>
              <h3 className="text-lg font-semibold text-cu-dark mb-2">
                Contact Info
              </h3>
              <p className="text-slate-600 text-sm">
                Find university contact numbers, email addresses, and campus
                location information.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-cu-dark mb-4">
            Ready to get started?
          </h2>
          <p className="text-slate-600 mb-8">
            Chat with Cubot now to get all your questions answered about City
            University Peshawar.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-6 py-3 bg-cu-blue text-white font-medium rounded-lg hover:bg-cu-blue-mid transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            Open Chat
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-200">
        <div className="max-w-4xl mx-auto text-center text-slate-500 text-sm">
          <p>Powered by Cubot AI — City University Peshawar</p>
        </div>
      </footer>
    </div>
  )
}