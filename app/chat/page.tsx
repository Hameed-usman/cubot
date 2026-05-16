import { ChatWindow } from '@/components/chat/ChatWindow'
import { Header } from '@/components/layout/Header'

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <ChatWindow />
        </div>
      </main>
    </div>
  )
}