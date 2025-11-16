'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'
import { io, Socket } from 'socket.io-client'
import Link from 'next/link'

interface User {
  evmAddress: string
  username: string
  avatarUrl: string
}

interface ChatMessage {
  id: string
  squadId: string
  author: User
  content: string
  isBot: boolean
  timestamp: string
}

interface Squad {
  id: number
  name: string
  inviteCode: string
  members: User[]
}

export default function SquadChatPage() {
  const router = useRouter()
  const params = useParams()
  const squadId = params.id as string
  const { token, user } = useAuthStore()

  const [squad, setSquad] = useState<Squad | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [sending, setSending] = useState(false)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load squad and messages
  useEffect(() => {
    if (!token) {
      router.push('/')
      return
    }

    const loadData = async () => {
      try {
        setLoading(true)
        const [squadData, messagesData] = await Promise.all([
          api.getSquad(token, squadId),
          api.getMessages(token, squadId),
        ])
        setSquad(squadData.squad)
        setMessages(messagesData.messages)
      } catch (err) {
        console.error('Failed to load data:', err)
        router.push('/squads')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [token, squadId, router])

  // Setup Socket.IO
  useEffect(() => {
    if (!token || !squadId) return

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      auth: { token },
    })

    socket.on('connect', () => {
      console.log('✅ Connected to chat server')
      setConnected(true)
      socket.emit('join:squad', squadId)
    })

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from chat server')
      setConnected(false)
    })

    socket.on('chat:receive', (message: ChatMessage) => {
      console.log('📩 Received message:', message)
      setMessages((prev) => [...prev, message])
    })

    socket.on('leaderboard:refresh', () => {
      console.log('🔄 Leaderboard refresh triggered by bot')
      loadLeaderboard()
    })

    socket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error)
      alert(error.message)
    })

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      setConnected(false)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [token, squadId])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()

    if (!socketRef.current || !newMessage.trim() || sending) return

    setSending(true)
    socketRef.current.emit('chat:send', {
      squadId,
      content: newMessage.trim(),
    })

    setNewMessage('')
    setSending(false)
  }

  const loadLeaderboard = async () => {
    if (!token) return
    
    setLoadingLeaderboard(true)
    try {
      const data = await api.getLeaderboard(token, squadId)
      setLeaderboard(data.leaderboard)
      setShowLeaderboard(true)
    } catch (err) {
      console.error('Failed to load leaderboard:', err)
      alert('Failed to load leaderboard')
    } finally {
      setLoadingLeaderboard(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f23] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#7c3aed] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#9ca3af]">Loading chat...</p>
        </div>
      </div>
    )
  }

  if (!squad) {
    return null
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f0f23]">
      {/* Header */}
      <div className="bg-[#1a1a2e] border-b border-[#2d2d44] p-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/squads" className="text-[#7c3aed] hover:text-[#8b5cf6] flex items-center gap-1">
              <span>←</span> Squads
            </Link>
            <div className="h-6 w-px bg-[#2d2d44]"></div>
            <div>
              <h1 className="text-lg font-bold text-[#e5e5f0]">{squad.name}</h1>
              <p className="text-xs text-[#9ca3af]">{squad.members.length} members</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadLeaderboard()}
              disabled={loadingLeaderboard}
              className="px-4 py-2 bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium text-white"
            >
              {loadingLeaderboard ? 'Loading...' : '🏆 Leaderboard'}
            </button>
            <div className="flex -space-x-2">
              {squad.members.slice(0, 3).map((member) => (
                <img
                  key={member.evmAddress}
                  src={member.avatarUrl}
                  alt={member.username}
                  className="w-8 h-8 rounded-full border-2 border-[#1a1a2e] ring-1 ring-[#7c3aed]/30"
                  title={member.username}
                />
              ))}
              {squad.members.length > 3 && (
                <div className="w-8 h-8 rounded-full bg-[#252541] border-2 border-[#1a1a2e] flex items-center justify-center text-[10px] text-[#9ca3af]">
                  +{squad.members.length - 3}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-[#9ca3af] py-16">
              <div className="mb-3 text-4xl">💬</div>
              <p className="text-base font-medium text-[#e5e5f0] mb-1">No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwnMessage = user && msg.author?.evmAddress === user.evmAddress
              
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} ${msg.isBot ? 'justify-center' : ''}`}
                >
                  {!msg.isBot && msg.author && (
                    <img
                      src={msg.author.avatarUrl}
                      alt={msg.author.username}
                      className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-[#7c3aed]/20"
                    />
                  )}
                  <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%]`}>
                    <div className="flex items-baseline gap-2 mb-1 px-2">
                      <span className="font-medium text-xs text-[#9ca3af]">
                        {msg.isBot ? '🤖 Trading Bot' : msg.author?.username || 'Anonymous'}
                      </span>
                      <span className="text-[10px] text-[#6b7280]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div
                      className={`px-4 py-2.5 rounded-xl ${
                        msg.isBot
                          ? 'bg-gradient-to-br from-[#7c3aed]/20 to-[#3b82f6]/20 border border-[#7c3aed]/30'
                          : isOwnMessage
                          ? 'bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] text-white'
                          : 'bg-[#1a1a2e] border border-[#2d2d44]'
                      }`}
                    >
                      <div
                        className={`text-sm break-words ${msg.isBot || !isOwnMessage ? 'text-[#e5e5f0]' : ''}`}
                        dangerouslySetInnerHTML={{ __html: msg.content }}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-[#1a1a2e] border-t border-[#2d2d44] p-4 flex-shrink-0">
        <form onSubmit={handleSendMessage} className="max-w-5xl mx-auto flex gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={connected ? 'Type a message...' : 'Connecting...'}
            disabled={!connected || sending}
            className="flex-1 px-4 py-3 bg-[#0f0f23] border border-[#2d2d44] rounded-lg text-[#e5e5f0] placeholder:text-[#6b7280] focus:border-[#7c3aed] focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!connected || !newMessage.trim() || sending}
            className="px-8 py-3 bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Send
          </button>
        </form>
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowLeaderboard(false)}
        >
          <div
            className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6 max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-[#e5e5f0]">🏆 Live Leaderboard</h2>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="text-[#9ca3af] hover:text-[#e5e5f0] text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-2.5 mb-5">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.evmAddress}
                  className={`flex items-center gap-3 p-4 rounded-xl transition ${
                    index === 0
                      ? 'bg-gradient-to-r from-[#f59e0b]/20 to-[#f97316]/20 border border-[#f59e0b]/30'
                      : 'bg-[#0f0f23] border border-[#2d2d44] hover:border-[#7c3aed]/30'
                  }`}
                >
                  <div className="text-xl font-bold w-7 text-center">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : <span className="text-[#6b7280] text-sm">{index + 1}</span>}
                  </div>
                  <img
                    src={entry.avatarUrl}
                    alt={entry.username}
                    className="w-11 h-11 rounded-full ring-2 ring-[#7c3aed]/30"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#e5e5f0]">{entry.username}</p>
                    {entry.topPosition && (
                      <p className="text-[10px] text-[#9ca3af] mt-1 leading-tight">
                        🔥 Best: {entry.topPosition.outcome} in{' '}
                        {entry.topPosition.slug ? (
                          <a
                            href={`https://polymarket.com/event/${entry.topPosition.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#7c3aed] hover:text-[#8b5cf6] underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {entry.topPosition.title.substring(0, 30)}{entry.topPosition.title.length > 30 ? '...' : ''}
                          </a>
                        ) : (
                          <span>{entry.topPosition.title.substring(0, 30)}{entry.topPosition.title.length > 30 ? '...' : ''}</span>
                        )}
                        {' '}(+${entry.topPosition.cashPnl})
                      </p>
                    )}
                  </div>
                  <div className={`font-bold text-base ${
                    entry.totalLivePnl > 0
                      ? 'text-[#10b981]'
                      : entry.totalLivePnl < 0
                      ? 'text-[#ef4444]'
                      : 'text-[#9ca3af]'
                  }`}>
                    {entry.totalLivePnl > 0 ? '+' : ''}${entry.totalLivePnl.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowLeaderboard(false)}
              className="w-full px-4 py-3 bg-[#0f0f23] border border-[#2d2d44] rounded-lg hover:bg-[#252541] text-[#e5e5f0] font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
