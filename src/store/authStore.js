import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isRefreshingUser: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { token, user } = response.data;
          
          set({ 
            user, 
            token, 
            isAuthenticated: true, 
            isLoading: false 
          });
          
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return { 
            success: false, 
            message: error.response?.data?.message || 'Login failed' 
          };
        }
      },

      register: async (username, email, password) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/register', { username, email, password });
          const { token, user } = response.data;
          
          set({ 
            user, 
            token, 
            isAuthenticated: true, 
            isLoading: false 
          });
          
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return { 
            success: false, 
            message: error.response?.data?.message || 'Registration failed' 
          };
        }
      },

      logout: () => {
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false,
          isRefreshingUser: false,
        });
      },

      updateUser: (userData) => {
        set({ user: { ...get().user, ...userData } });
      },

      refreshCurrentUser: async () => {
        const { token, isAuthenticated } = get();
        if (!token || !isAuthenticated) return null;

        set({ isRefreshingUser: true });
        try {
          const response = await api.get('/auth/me');
          const nextUser = response.data?.user || null;
          if (nextUser) {
            set({
              user: nextUser,
              isAuthenticated: true,
              isRefreshingUser: false,
            });
          } else {
            set({ isRefreshingUser: false });
          }
          return nextUser;
        } catch (error) {
          set({ isRefreshingUser: false });
          return null;
        }
      }
    }),
    {
      name: 'chatapp-auth',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);
