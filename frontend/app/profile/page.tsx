'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'
import Link from 'next/link'

export default function ProfilePage() {
  const router = useRouter()
  const { token, user, updateUser, logout } = useAuthStore()
  
  const [username, setUsername] = useState('')
  const [polymarketAddress, setPolymarketAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      router.push('/')
      return
    }
    
    if (user) {
      setUsername(user.username || '')
      setPolymarketAddress(user.polymarketUserAddress || '')
    }
  }, [token, user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    setLoading(true)
    setMessage('')

    try {
      const { user: updatedUser } = await api.updateProfile(token, {
        username: username.trim() || undefined,
        polymarketUserAddress: polymarketAddress.trim() || undefined,
      })

      updateUser(updatedUser)
      setMessage('Profile updated successfully!')
    } catch (error) {
      setMessage('Failed to update profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0f0f23] text-[#e5e5f0] p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-[#7c3aed] hover:text-[#8b5cf6] flex items-center gap-2">
            <span>←</span> Home
          </Link>
          <button onClick={handleLogout} className="text-[#ef4444] hover:text-[#dc2626] font-medium">
            Logout
          </button>
        </div>

        <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <img src={user.avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full ring-2 ring-[#7c3aed]"/>
            <div>
              <h1 className="text-2xl font-bold">Profile Settings</h1>
              <p className="text-sm text-[#9ca3af] font-mono">{user.polymarketUserAddress?.slice(0, 6)}...{user.polymarketUserAddress?.slice(-4)}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2 text-[#9ca3af]">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-[#0f0f23] border border-[#2d2d44] rounded-lg focus:border-[#7c3aed] focus:outline-none"
                placeholder="Enter your username"
              />
              <p className="text-xs text-[#6b7280] mt-2">
                Your display name in chats and leaderboards
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-[#9ca3af]">
                Polymarket Address
              </label>
              <input
                type="text"
                value={polymarketAddress}
                disabled
                className="w-full px-4 py-3 bg-[#0f0f23]/50 border border-[#2d2d44] rounded-lg font-mono text-sm text-[#6b7280] cursor-not-allowed"
                placeholder="0x..."
              />
              <p className="text-xs text-[#6b7280] mt-2">
                Your Polymarket address (set at login)
              </p>
            </div>

            {message && (
              <div className={`p-4 rounded-lg border ${
                message.includes('success') 
                  ? 'bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]' 
                  : 'bg-[#ef4444]/10 border-[#ef4444]/20 text-[#ef4444]'
              }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] rounded-lg hover:opacity-90 transition disabled:opacity-50 font-medium"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        <div className="bg-[#1a1a2e]/50 border border-[#2d2d44]/50 rounded-xl p-5">
          <h3 className="font-semibold mb-2 text-sm">Demo Mode</h3>
          <p className="text-xs text-[#9ca3af]">
            This is a demo using Polymarket addresses for login. A production app would integrate with Polymarket's OAuth system.
          </p>
        </div>
      </div>
    </div>
  )
}
