import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { applyTheme } from '../lib/theme'

export const useAuthStore = create((set, get) => ({
  user:    null,
  profile: null,
  loading: true,
  _authSubscription: null,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ user: session.user })
      await get().fetchProfile(session.user.id)
    }
    set({ loading: false })

    // Fix 6: store subscription so it can be cleaned up
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        set({ user: session.user })
        await get().fetchProfile(session.user.id)
      } else {
        set({ user: null, profile: null })
        applyTheme('default')
      }
    })
    set({ _authSubscription: subscription })
  },

  fetchProfile: async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) {
      set({ profile: data })
      applyTheme(data.theme || 'default')
    }
  },

  signOut: async () => {
    const { _authSubscription } = get()
    if (_authSubscription) _authSubscription.unsubscribe()
    await supabase.auth.signOut()
    set({ user: null, profile: null, _authSubscription: null })
    applyTheme('default')
  },
}))
