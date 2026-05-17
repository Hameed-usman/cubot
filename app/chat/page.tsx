import { ChatWindow } from '@/components/chat/ChatWindow'
import { Header } from '@/components/layout/Header'
import { ParticlesBackground } from '@/components/ui/ParticlesBackground'

export default function ChatPage() {
  return (
    <div className="min-h-screen animated-bg relative">
      <ParticlesBackground />
      <div className="relative z-10">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <ChatWindow />
          </div>
        </main>
      </div>
    </div>
  )
}