import { apiClient } from './client';
import { AuthResponse, User } from '../types';

export const authApi = {
  async register(email: string, password: string): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/auth/register', { email, password });
    return res.data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    return res.data;
  },

  async getMe(): Promise<{ success: boolean; data: { user: User } }> {
    const res = await apiClient.get<{ success: boolean; data: { user: User } }>('/auth/me');
    return res.data;
  },
};
