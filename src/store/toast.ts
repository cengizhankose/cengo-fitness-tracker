import { create } from 'zustand'

export interface ToastMsg {
  id: string
  text: string
  tone: 'default' | 'success'
}

interface ToastState {
  toasts: ToastMsg[]
  push: (text: string, tone?: ToastMsg['tone']) => void
  dismiss: (id: string) => void
}

let counter = 0

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (text, tone = 'default') => {
    const id = `t${counter++}`
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2200)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
