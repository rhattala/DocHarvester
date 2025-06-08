import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'
import toast from 'react-hot-toast'

interface User {
  id: number
  email: string
  full_name: string
  is_admin: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          const response = await axios.post('/api/v1/auth/token', {
            username: email,
            password: password,
          }, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          })

          const { access_token } = response.data
          
          // Set default authorization header
          axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

          // Get user info
          const userResponse = await axios.get('/api/v1/auth/me')
          
          set({
            token: access_token,
            user: userResponse.data,
            isAuthenticated: true,
          })

          toast.success('Login successful!')
        } catch (error) {
          toast.error('Invalid email or password')
          throw error
        }
      },

      register: async (email: string, password: string, fullName: string) => {
        try {
          await axios.post('/api/v1/auth/register', {
            email,
            password,
            full_name: fullName,
          })

          // After successful registration, log the user in
          const loginResponse = await axios.post('/api/v1/auth/token', {
            username: email,
            password: password,
          }, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          })

          const { access_token } = loginResponse.data
          
          // Set default authorization header
          axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

          // Get user info
          const userResponse = await axios.get('/api/v1/auth/me')
          
          set({
            token: access_token,
            user: userResponse.data,
            isAuthenticated: true,
          })

          toast.success('Registration successful!')
        } catch (error: any) {
          if (error.response?.data?.detail === 'Email already registered') {
            toast.error('Email already registered')
          } else {
            toast.error('Registration failed')
          }
          throw error
        }
      },

      logout: () => {
        delete axios.defaults.headers.common['Authorization']
        set({ user: null, token: null, isAuthenticated: false })
        toast.success('Logged out successfully')
      },

      setUser: (user: User) => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
)

// Initialize axios with stored token
const storedAuth = localStorage.getItem('auth-storage')
if (storedAuth) {
  try {
    const { state } = JSON.parse(storedAuth)
    if (state.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${state.token}`
    }
  } catch (error) {
    console.error('Failed to parse stored auth:', error)
  }
} 