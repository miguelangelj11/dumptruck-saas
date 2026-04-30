'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatWidget({ plan }: { plan: string | null | undefined }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  if (plan !== 'enterprise') return null

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-10) }),
      })
      const data = await res.json()
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Open assistant"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'var(--accent, #2d7a4f)' }}
      >
        {open
          ? <X className="w-6 h-6 text-white" />
          : <MessageCircle className="w-6 h-6 text-white" />
        }
      </button>

      {/* Chat panel */}
      <div
        className={`
          fixed z-50 shadow-2xl rounded-2xl overflow-hidden flex flex-col
          transition-all duration-300 ease-in-out
          bottom-24 right-6
          w-[calc(100vw-3rem)] sm:w-[400px]
          ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}
        `}
        style={{ height: 'min(500px, calc(100vh - 8rem))' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ background: 'var(--primary, #1e3a2a)' }}
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">DumpTruckBoss Assistant</p>
            <p className="text-white/60 text-xs">Powered by Claude AI</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white/90 shrink-0">
            ENTERPRISE
          </span>
          <button
            onClick={() => setOpen(false)}
            className="text-white/70 hover:text-white ml-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center text-gray-400 px-4">
              <Bot className="w-10 h-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">How can I help you today?</p>
              <p className="text-xs">Ask me about dispatching, invoices, drivers, or anything else in DumpTruckBoss.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                  ${msg.role === 'user'
                    ? 'text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }
                `}
                style={msg.role === 'user' ? { background: 'var(--accent, #2d7a4f)' } : undefined}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-gray-100 bg-white px-3 py-2 flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a question…"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-gray-400 placeholder-gray-400 max-h-28 leading-relaxed disabled:opacity-50"
            style={{ overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-opacity disabled:opacity-40"
            style={{ background: 'var(--accent, #2d7a4f)' }}
            aria-label="Send"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </>
  )
}
