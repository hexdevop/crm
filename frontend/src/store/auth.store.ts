import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { MeUser } from '@/types/user'

interface AuthState {
  accessToken: string | null
  user: MeUser | null
  isAuthenticated: boolean

  setAccessToken: (token: string) => void
  setUser: (user: MeUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,

      setAccessToken: (token) =>
        set({ accessToken: token, isAuthenticated: true }),

      setUser: (user) =>
        set({ user }),

      logout: () =>
        set({ accessToken: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'crm-auth',
      storage: createJSONStorage(() => localStorage), // localStorage сохраняет данные между вкладками
      partialize: (state) => ({
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// Permission helpers — sync reads, no extra API calls
export const useHasPermission = (permission: string): boolean => {
  const user = useAuthStore((s) => s.user)
  if (!user) return false
  if (user.is_superadmin) return true
  return user.permissions.includes('*') || user.permissions.includes(permission)
}

export const usePermissions = (): string[] => {
  return useAuthStore((s) => s.user?.permissions ?? [])
}
