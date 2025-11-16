'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'
import Link from 'next/link'

interface User {
  polymarketUserAddress: string;
  username: string;
  avatarUrl: string;
}

interface Squad {
  id: number;
  name: string;
  inviteCode: string;
  members: User[];
}

export default function SquadsPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  
  const [squads, setSquads] = useState<Squad[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [newSquadName, setNewSquadName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      router.push('/')
      return
    }
    
    loadSquads()
  }, [token, router])

  const loadSquads = async () => {
    if (!token) return
    
    try {
      setLoading(true)
      const { squads: fetchedSquads } = await api.getSquads(token)
      setSquads(fetchedSquads)
    } catch (err) {
      console.error('Failed to load squads:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSquad = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !newSquadName.trim()) return

    try {
      setActionLoading(true)
      setError('')
      const { squad } = await api.createSquad(token, newSquadName.trim())
      setSquads([...squads, squad])
      setShowCreateModal(false)
      setNewSquadName('')
    } catch (err) {
      setError('Failed to create squad. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleJoinSquad = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !inviteCode.trim()) return

    try {
      setActionLoading(true)
      setError('')
      const { squad } = await api.joinSquad(token, inviteCode.trim())
      
      // Check if already in list
      const exists = squads.find(s => s.id === squad.id)
      if (!exists) {
        setSquads([...squads, squad])
      }
      
      setShowJoinModal(false)
      setInviteCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join squad')
    } finally {
      setActionLoading(false)
    }
  }

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code)
    alert('Invite code copied to clipboard!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f23] flex items-center justify-center">
        <p className="text-[#9ca3af]">Loading squads...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0f23] text-[#e5e5f0] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-[#7c3aed] hover:text-[#8b5cf6] text-sm flex items-center gap-2">
              <span>←</span> Home
            </Link>
            <h1 className="text-3xl font-bold mt-2">My Squads</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              + Create Squad
            </button>
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-5 py-2.5 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg hover:bg-[#252541] hover:border-[#7c3aed] transition-all font-medium"
            >
              Join Squad
            </button>
          </div>
        </div>

        {squads.length === 0 ? (
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <p className="text-[#9ca3af] mb-2">No squads yet</p>
            <p className="text-sm text-[#6b7280]">Create or join a squad to start trading together</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {squads.map((squad) => (
              <Link
                key={squad.id}
                href={`/squads/${squad.id}`}
                className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6 hover:bg-[#252541] hover:border-[#7c3aed] transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold mb-1 group-hover:text-[#7c3aed] transition-colors">{squad.name}</h3>
                    <p className="text-sm text-[#9ca3af]">{squad.members.length} member{squad.members.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      copyInviteCode(squad.inviteCode)
                    }}
                    className="px-3 py-1.5 bg-[#0f0f23] border border-[#2d2d44] rounded-lg hover:border-[#7c3aed] transition-colors text-sm font-mono"
                  >
                    📋 {squad.inviteCode}
                  </button>
                </div>

                <div className="flex -space-x-2">
                  {squad.members.slice(0, 5).map((member) => (
                    <img
                      key={member.polymarketUserAddress}
                      src={member.avatarUrl}
                      alt={member.username}
                      className="w-10 h-10 rounded-full border-2 border-[#1a1a2e] ring-1 ring-[#2d2d44]"
                      title={member.username}
                    />
                  ))}
                  {squad.members.length > 5 && (
                    <div className="w-10 h-10 rounded-full bg-[#0f0f23] border-2 border-[#1a1a2e] ring-1 ring-[#2d2d44] flex items-center justify-center text-xs text-[#9ca3af]">
                      +{squad.members.length - 5}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Create Squad Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCreateModal(false)}>
            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-6">Create Squad</h2>
              <form onSubmit={handleCreateSquad} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#9ca3af]">Squad Name</label>
                  <input
                    type="text"
                    value={newSquadName}
                    onChange={(e) => setNewSquadName(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0f0f23] border border-[#2d2d44] rounded-lg focus:border-[#7c3aed] focus:outline-none"
                    placeholder="The Alpha Team"
                    maxLength={50}
                    required
                  />
                </div>

                {error && (
                  <p className="text-[#ef4444] text-sm">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setNewSquadName('')
                      setError('')
                    }}
                    className="flex-1 px-4 py-2.5 bg-[#0f0f23] border border-[#2d2d44] rounded-lg hover:bg-[#252541] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] rounded-lg hover:opacity-90 transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Join Squad Modal */}
        {showJoinModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowJoinModal(false)}>
            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-6">Join Squad</h2>
              <form onSubmit={handleJoinSquad} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#9ca3af]">Invite Code</label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 bg-[#0f0f23] border border-[#2d2d44] rounded-lg focus:border-[#7c3aed] focus:outline-none font-mono text-lg text-center tracking-wider"
                    placeholder="ABC123"
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-[#6b7280] mt-2">6-character code from your friend</p>
                </div>

                {error && (
                  <p className="text-[#ef4444] text-sm">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowJoinModal(false)
                      setInviteCode('')
                      setError('')
                    }}
                    className="flex-1 px-4 py-2.5 bg-[#0f0f23] border border-[#2d2d44] rounded-lg hover:bg-[#252541] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#10b981] to-[#10b981] rounded-lg hover:opacity-90 transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
