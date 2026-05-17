'use client'

import Link from 'next/link'
import { MessageCircle, GraduationCap, BookOpen, Phone, Star, Sparkles, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Animated Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 animated-bg" />

        {/* Floating shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-32 h-32 bg-white/10 rounded-full float-animation blur-xl" />
          <div className="absolute top-40 right-20 w-48 h-48 bg-cu-gold/20 rounded-full float-animation blur-xl" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-cu-blue/20 rounded-full float-animation blur-xl" style={{ animationDelay: '2s' }} />
          <div className="absolute bottom-40 right-1/3 w-36 h-36 bg-white/10 rounded-full float-animation blur-xl" style={{ animationDelay: '0.5s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-md rounded-full mb-8 border border-white/30">
            <Sparkles className="w-5 h-5 text-cu-gold" />
            <span className="text-white font-medium">Official AI Assistant</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Meet <span className="text-cu-gold drop-shadow-lg">Cubot</span>
            <br />
            Your University Guide
          </h1>

          <p className="text-xl md:text-2xl text-white/90 mb-10 max-w-2xl mx-auto">
            Experience the future of university assistance. Intelligent, helpful, and always ready to guide you.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/chat"
              className="group glow-btn inline-flex items-center gap-3 px-8 py-4 bg-cu-gold text-cu-dark font-semibold rounded-2xl hover:bg-cu-gold/90 transition-all transform hover:scale-105"
            >
              <MessageCircle className="w-6 h-6" />
              Start Conversation
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="#features"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/20 text-white font-medium rounded-2xl hover:bg-white/30 transition-all border border-white/30"
            >
              Explore Features
            </Link>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-12 mt-16">
            <div className="text-center">
              <div className="text-4xl font-bold text-cu-gold">5+</div>
              <div className="text-white/70">Departments</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-cu-gold">24/7</div>
              <div className="text-white/70">Available</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-cu-gold">Bilingual</div>
              <div className="text-white/70">English & Urdu</div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-white rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-cu-dark mb-4">
              Why Choose <span className="gradient-text">Cubot?</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Experience a revolutionary way to get university information
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: GraduationCap,
                title: 'Smart Admissions',
                desc: 'Get instant guidance on admission requirements, eligibility, and deadlines.',
                color: 'bg-cu-blue'
              },
              {
                icon: BookOpen,
                title: 'Course Details',
                desc: 'Explore complete course structures, semester plans, and curriculum.',
                color: 'bg-cu-gold'
              },
              {
                icon: Phone,
                title: 'Contact Info',
                desc: 'Find all department contacts, locations, and office hours instantly.',
                color: 'bg-cu-blue'
              }
            ].map((feature, idx) => (
              <div
                key={idx}
                className="group glass-card p-8 rounded-3xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
              >
                <div className={`w-16 h-16 ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-cu-dark mb-3">{feature.title}</h3>
                <p className="text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Additional Features */}
          <div className="mt-16 grid md:grid-cols-2 gap-8">
            <div className="glass-card p-8 rounded-3xl border-l-4 border-cu-blue">
              <div className="flex items-center gap-3 mb-4">
                <Star className="w-6 h-6 text-cu-gold" />
                <h3 className="text-xl font-bold text-cu-dark">Bilingual Support</h3>
              </div>
              <p className="text-slate-600">
                Ask questions in English or Urdu - Cubot understands and responds in your preferred language.
              </p>
            </div>

            <div className="glass-card p-8 rounded-3xl border-l-4 border-cu-gold">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-cu-gold" />
                <h3 className="text-xl font-bold text-cu-dark">Learning System</h3>
              </div>
              <p className="text-slate-600">
                Cubot learns from corrections and improves over time to provide better answers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-cu-blue">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Start chatting with Cubot now and get all your university questions answered!
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-3 px-10 py-5 bg-cu-gold text-cu-dark font-bold rounded-2xl hover:bg-cu-gold/90 transition-all transform hover:scale-105 shadow-lg"
          >
            <MessageCircle className="w-6 h-6" />
            Start Chatting Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-cu-dark">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-white/60 mb-2">© 2024 City University Peshawar. All rights reserved.</p>
          <p className="text-white/40 text-sm">Powered by Cubot AI</p>
        </div>
      </footer>
    </div>
  )
}