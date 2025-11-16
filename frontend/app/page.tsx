'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'
import Link from 'next/link'

export default function Home() {
  const router = useRouter()
  const { user, setAuth } = useAuthStore()
  const [evmAddress, setEvmAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!evmAddress.trim()) {
      setError('Please enter an address')
      return
    }

    if (!evmAddress.startsWith('0x') || evmAddress.length !== 42) {
      setError('Invalid address format')
      return
    }

    try {
      setLoading(true)
      setError('')
      const { token, user } = await api.login(evmAddress)
      setAuth(token, user)
      router.push('/squads')
    } catch (err) {
      setError('Login failed')
    } finally {
      setLoading(false)
    }
  }

  if (user) {
    return (
      <div className="min-h-screen bg-[#0f0f23] text-[#e5e5f0] flex items-center justify-center p-6">
        <div className="max-w-xl w-full space-y-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
              Social Squads
            </h1>
            <p className="text-[#9ca3af]">Group trading, leaderboards & live chat</p>
          </div>

          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6 hover:border-[#7c3aed] transition-colors">
            <div className="flex items-center gap-4 mb-4">
              <img src={user.avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full ring-2 ring-[#7c3aed]"/>
              <div>
                <p className="font-semibold text-lg">{user.username}</p>
                <p className="text-sm text-[#9ca3af] font-mono">{user.evmAddress?.slice(0, 6)}...{user.evmAddress?.slice(-4)}</p>
              </div>
            </div>
            {user.polymarketUserAddress ? (
              <p className="text-sm text-[#10b981] flex items-center gap-2">
                <span className="w-2 h-2 bg-[#10b981] rounded-full"></span>
                Polymarket linked
              </p>
            ) : (
              <p className="text-sm text-[#f59e0b] flex items-center gap-2">
                <span className="w-2 h-2 bg-[#f59e0b] rounded-full"></span>
                Link Polymarket address in Profile
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Link href="/profile" className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4 text-center hover:bg-[#252541] hover:border-[#7c3aed] transition-all">
              <div className="text-2xl mb-2">⚙️</div>
              <div className="font-medium">Profile</div>
            </Link>
            <Link href="/squads" className="bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] rounded-xl p-4 text-center hover:opacity-90 transition-opacity">
              <div className="text-2xl mb-2">🏆</div>
              <div className="font-medium">My Squads</div>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0f23] text-[#e5e5f0] flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
            Social Squads
          </h1>
          <p className="text-[#9ca3af]">Group trading, leaderboards & live chat</p>
        </div>

        <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6">
          <h2 className="text-xl font-bold mb-6">Demo Login</h2>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[#9ca3af]">EVM Address</label>
              <input
                type="text"
                value={evmAddress}
                onChange={(e) => setEvmAddress(e.target.value)}
                className="w-full px-4 py-3 bg-[#0f0f23] border border-[#2d2d44] rounded-lg focus:border-[#7c3aed] focus:outline-none font-mono text-sm"
                placeholder="0x..."
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
            >
              {loading ? 'Logging in...' : 'Enter App'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#2d2d44]">
            <p className="text-xs text-[#9ca3af] mb-3">Quick Demo</p>
            <div className="space-y-2 text-xs">
              {[
                ['0x1234567890123456789012345678901234567890', 'Alex'],
                ['0xABCDEF1234567890ABCDEF1234567890ABCDEF12', 'Steve'],
                ['0x9876543210987654321098765432109876543210', 'Jordan']
              ].map(([addr, name]) => (
                <button
                  key={addr}
                  type="button"
                  onClick={() => setEvmAddress(addr)}
                  className="w-full text-left px-3 py-2 bg-[#0f0f23] hover:bg-[#252541] rounded-lg transition-colors font-mono"
                >
                  {name}: {addr.slice(0, 6)}...{addr.slice(-4)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
