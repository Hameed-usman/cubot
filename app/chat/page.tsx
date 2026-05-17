import type { Metadata } from 'next'
import { ChatHeader, MobileTabBar } from '@/components/layout/Header'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { ToastProvider } from '@/components/ui/Toast'

export const metadata: Metadata = {
  title: 'Chat — Cubot AI Assistant',
  description:
    'Start a conversation with Cubot, the official AI assistant of City University Peshawar. Ask about admissions, fees, courses, and more.',
}

export default function ChatPage() {
  return (
    <>
      <ToastProvider />
      {/* Full-screen layout */}
      <div className="aurora-bg flex flex-col h-screen overflow-hidden">
        {/* Top header bar */}
        <ChatHeader />

        {/* Body: sidebar + main */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar — hidden on mobile */}
          <ChatSidebar />

          {/* Main chat area */}
          <main
            className="flex-1 flex flex-col overflow-hidden glass-dark border-0"
            style={{ background: 'rgba(8, 13, 26, 0.6)' }}
            aria-label="Chat interface"
          >
            {/* Frosted glass chat container */}
            <div className="flex-1 flex flex-col overflow-hidden mx-auto w-full max-w-4xl">
              <ChatWindow />
            </div>
          </main>
        </div>

        {/* Mobile bottom tab bar — hidden on lg+ */}
        <MobileTabBar />
      </div>
    </>
  )
}