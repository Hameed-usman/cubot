import { Bot } from 'lucide-react'
import { motion } from 'framer-motion'

export function TypingIndicator() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="max-w-[85%]">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cu-gold to-yellow-500 flex items-center justify-center flex-shrink-0 shadow-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>

          {/* Content */}
          <div className="bg-white/80 backdrop-blur-md border border-white/50 px-5 py-4 rounded-2xl rounded-bl-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] glass-card">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <motion.div 
                  className="w-2 h-2 bg-cu-blue rounded-full" 
                  animate={{ y: [0, -5, 0] }} 
                  transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} 
                />
                <motion.div 
                  className="w-2 h-2 bg-cu-blue rounded-full" 
                  animate={{ y: [0, -5, 0] }} 
                  transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} 
                />
                <motion.div 
                  className="w-2 h-2 bg-cu-blue rounded-full" 
                  animate={{ y: [0, -5, 0] }} 
                  transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} 
                />
              </div>
              <span className="text-sm font-medium text-slate-500 ml-2">Cubot is thinking...</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}