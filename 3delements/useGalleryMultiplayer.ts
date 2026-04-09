/**
 * useGalleryMultiplayer.ts
 * 
 * Supabase Realtime hook for StudioLoom's multiplayer gallery.
 * Handles three channel types:
 *   1. Presence  — who's in the room + their avatar config
 *   2. Broadcast — player position updates at ~10fps
 *   3. Database  — chat messages & reactions (persisted + live)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient, RealtimeChannel } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────

interface PlayerState {
  id: string
  name: string
  role: 'student' | 'parent' | 'teacher' | 'visitor'
  color: string
  x: number
  z: number
  angle: number
  lastUpdate: number
}

interface ChatMessage {
  id: string
  sender_name: string
  sender_color: string
  sender_role: string
  message: string
  created_at: string
}

interface Reaction {
  display_id: string
  emoji: string
  reactor_name: string
}

interface GalleryConfig {
  eventId: string
  playerName: string
  playerRole: string
  playerColor: string
  supabaseUrl: string
  supabaseAnonKey: string
}

// ── Constants ────────────────────────────────────────────────

const BROADCAST_INTERVAL_MS = 100   // 10fps position updates
const POSITION_LERP_FACTOR = 0.15   // smoothing for remote players
const STALE_PLAYER_MS = 5000        // remove players after 5s silence

// ── Hook ─────────────────────────────────────────────────────

export function useGalleryMultiplayer(config: GalleryConfig) {
  const [players, setPlayers] = useState<Map<string, PlayerState>>(new Map())
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const localPositionRef = useRef({ x: 0, z: 8, angle: Math.PI })
  const broadcastIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const playerIdRef = useRef(crypto.randomUUID())

  // ── Initialize Supabase + Channel ──────────────────────────

  useEffect(() => {
    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey)
    supabaseRef.current = supabase

    const channelName = `gallery:${config.eventId}`
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: playerIdRef.current },
        broadcast: { self: false },  // don't echo own broadcasts
      },
    })

    // ── PRESENCE: Track who's in the gallery ─────────────────

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const count = Object.keys(state).length
      setOnlineCount(count)
    })

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      const p = newPresences[0] as any
      if (key === playerIdRef.current) return

      setPlayers(prev => {
        const next = new Map(prev)
        next.set(key, {
          id: key,
          name: p.name,
          role: p.role,
          color: p.color,
          x: 0,
          z: 8,
          angle: Math.PI,
          lastUpdate: Date.now(),
        })
        return next
      })
    })

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      setPlayers(prev => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
    })

    // ── BROADCAST: Player position updates ───────────────────

    channel.on('broadcast', { event: 'player_move' }, ({ payload }) => {
      const { id, x, z, angle } = payload
      if (id === playerIdRef.current) return

      setPlayers(prev => {
        const next = new Map(prev)
        const existing = next.get(id)
        if (existing) {
          // Store target position — we'll lerp in the render loop
          next.set(id, {
            ...existing,
            x, z, angle,
            lastUpdate: Date.now(),
          })
        }
        return next
      })
    })

    // ── BROADCAST: Reactions (ephemeral, also persisted to DB) ─

    channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      setReactions(prev => [...prev.slice(-50), payload as Reaction])
    })

    // ── Subscribe ────────────────────────────────────────────

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)

        // Track presence
        await channel.track({
          name: config.playerName,
          role: config.playerRole,
          color: config.playerColor,
          joined_at: new Date().toISOString(),
        })

        // Start broadcasting position
        broadcastIntervalRef.current = setInterval(() => {
          const pos = localPositionRef.current
          channel.send({
            type: 'broadcast',
            event: 'player_move',
            payload: {
              id: playerIdRef.current,
              x: pos.x,
              z: pos.z,
              angle: pos.angle,
            },
          })
        }, BROADCAST_INTERVAL_MS)
      }
    })

    channelRef.current = channel

    // ── DATABASE: Listen for persisted chat messages ──────────

    const chatChannel = supabase
      .channel(`chat:${config.eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gallery_chat',
          filter: `event_id=eq.${config.eventId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage
          setChatMessages(prev => [...prev.slice(-50), msg])
        }
      )
      .subscribe()

    // ── Load initial chat history ────────────────────────────

    supabase
      .from('gallery_chat')
      .select('*')
      .eq('event_id', config.eventId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setChatMessages(data.reverse())
      })

    // ── Cleanup stale players ────────────────────────────────

    const staleCheck = setInterval(() => {
      setPlayers(prev => {
        const now = Date.now()
        const next = new Map(prev)
        for (const [key, player] of next) {
          if (now - player.lastUpdate > STALE_PLAYER_MS) {
            next.delete(key)
          }
        }
        return next
      })
    }, 2000)

    // ── Teardown ─────────────────────────────────────────────

    return () => {
      if (broadcastIntervalRef.current) clearInterval(broadcastIntervalRef.current)
      clearInterval(staleCheck)
      channel.unsubscribe()
      chatChannel.unsubscribe()
    }
  }, [config.eventId, config.playerName, config.playerRole, config.playerColor, config.supabaseUrl, config.supabaseAnonKey])

  // ── Public API ─────────────────────────────────────────────

  /** Call this from your render loop to update local position */
  const updatePosition = useCallback((x: number, z: number, angle: number) => {
    localPositionRef.current = { x, z, angle }
  }, [])

  /** Send a chat message (persisted to DB, delivered via Realtime) */
  const sendChat = useCallback(async (message: string) => {
    if (!supabaseRef.current || !message.trim()) return

    await supabaseRef.current.from('gallery_chat').insert({
      event_id: config.eventId,
      sender_name: config.playerName,
      sender_color: config.playerColor,
      sender_role: config.playerRole,
      message: message.trim(),
    })
  }, [config])

  /** Send a reaction (broadcast + persist) */
  const sendReaction = useCallback(async (displayId: string, emoji: string) => {
    if (!supabaseRef.current || !channelRef.current) return

    // Broadcast for instant feedback
    channelRef.current.send({
      type: 'broadcast',
      event: 'reaction',
      payload: {
        display_id: displayId,
        emoji,
        reactor_name: config.playerName,
      },
    })

    // Persist to DB
    await supabaseRef.current.from('artwork_reactions').insert({
      display_id: displayId,
      event_id: config.eventId,
      emoji,
      reactor_name: config.playerName,
    })
  }, [config])

  /** Interpolate remote player positions (call in render loop) */
  const getInterpolatedPlayers = useCallback((): PlayerState[] => {
    return Array.from(players.values())
  }, [players])

  return {
    // State
    players: getInterpolatedPlayers,
    chatMessages,
    reactions,
    onlineCount,
    isConnected,
    playerId: playerIdRef.current,

    // Actions
    updatePosition,
    sendChat,
    sendReaction,
  }
}


// ── Usage Example ────────────────────────────────────────────
/*
function GalleryScene() {
  const {
    players,
    chatMessages,
    onlineCount,
    isConnected,
    updatePosition,
    sendChat,
    sendReaction,
  } = useGalleryMultiplayer({
    eventId: 'exhibition-2026-04',
    playerName: 'Alex',
    playerRole: 'student',
    playerColor: '#e94560',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  })

  // In your Three.js render loop:
  useFrame(() => {
    // Update own position
    updatePosition(player.x, player.z, player.angle)

    // Render remote players with lerping
    const remotePlayers = players()
    remotePlayers.forEach(rp => {
      const mesh = playerMeshes.get(rp.id)
      if (mesh) {
        mesh.position.x += (rp.x - mesh.position.x) * 0.15
        mesh.position.z += (rp.z - mesh.position.z) * 0.15
        mesh.rotation.y += (rp.angle - mesh.rotation.y) * 0.15
      }
    })
  })

  // Chat
  const handleSend = (msg: string) => sendChat(msg)

  // Reactions
  const handleReact = (displayId: string) => sendReaction(displayId, '❤️')
}
*/
