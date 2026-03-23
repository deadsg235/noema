"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react"

export interface WalletState {
  connected: boolean
  address: string | null
  solBalance: number
  tokenBalance: number
  hasTokens: boolean
  connecting: boolean
  error: string | null
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

// Phantom provider type
interface PhantomProvider {
  isPhantom: boolean
  publicKey: { toString(): string } | null
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>
  disconnect(): Promise<void>
  on(event: string, handler: (...args: unknown[]) => void): void
  off(event: string, handler: (...args: unknown[]) => void): void
}

function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider }
  return w.phantom?.solana ?? w.solana ?? null
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    connected: false,
    address: null,
    solBalance: 0,
    tokenBalance: 0,
    hasTokens: false,
    connecting: false,
    error: null,
  })

  const syncRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const syncWallet = useCallback(async (address: string) => {
    try {
      const res = await fetch("/api/noe/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      })
      if (!res.ok) return
      const data = await res.json()
      setState((s) => ({
        ...s,
        solBalance: data.solBalance ?? 0,
        tokenBalance: data.tokenBalance ?? 0,
        hasTokens: data.hasTokens ?? false,
      }))
    } catch {}
  }, [])

  const connect = useCallback(async () => {
    const phantom = getPhantom()
    if (!phantom?.isPhantom) {
      setState((s) => ({ ...s, error: "Phantom wallet not found. Install it at phantom.app" }))
      return
    }

    setState((s) => ({ ...s, connecting: true, error: null }))
    try {
      const resp = await phantom.connect()
      const address = resp.publicKey.toString()
      setState((s) => ({ ...s, connected: true, address, connecting: false }))
      await syncWallet(address)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed"
      setState((s) => ({ ...s, connecting: false, error: msg }))
    }
  }, [syncWallet])

  const disconnect = useCallback(() => {
    getPhantom()?.disconnect()
    setState({
      connected: false,
      address: null,
      solBalance: 0,
      tokenBalance: 0,
      hasTokens: false,
      connecting: false,
      error: null,
    })
    if (syncRef.current) clearInterval(syncRef.current)
  }, [])

  // Auto-reconnect if already trusted
  useEffect(() => {
    const phantom = getPhantom()
    if (!phantom?.isPhantom) return
    phantom.connect({ onlyIfTrusted: true })
      .then((resp) => {
        const address = resp.publicKey.toString()
        setState((s) => ({ ...s, connected: true, address }))
        syncWallet(address)
      })
      .catch(() => {})
  }, [syncWallet])

  // Re-sync balance every 30s when connected
  useEffect(() => {
    if (!state.connected || !state.address) return
    syncRef.current = setInterval(() => syncWallet(state.address!), 30_000)
    return () => { if (syncRef.current) clearInterval(syncRef.current) }
  }, [state.connected, state.address, syncWallet])

  // Listen for Phantom account changes
  useEffect(() => {
    const phantom = getPhantom()
    if (!phantom) return
    const handler = () => disconnect()
    phantom.on("disconnect", handler)
    return () => phantom.off("disconnect", handler)
  }, [disconnect])

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider")
  return ctx
}
