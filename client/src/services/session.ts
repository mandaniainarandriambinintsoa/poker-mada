import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

export function refreshAccessToken(): Promise<string> {
  refreshPromise ??= axios
    .post(
      `${API_URL}/auth/refresh`,
      {},
      {
        timeout: 15000,
        withCredentials: true,
        headers: { 'X-Poker-Client': 'web' },
      },
    )
    .then((response) => {
      const token = response.data?.token;
      if (typeof token !== 'string' || token.length === 0) {
        throw new Error('Invalid refresh response');
      }
      setAccessToken(token);
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}
