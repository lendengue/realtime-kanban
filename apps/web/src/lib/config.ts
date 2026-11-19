const env = import.meta.env as Partial<Record<string, string>>;

export const config = {
  apiUrl: (env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  collabUrl: env.VITE_COLLAB_URL ?? 'ws://localhost:1234',
};

export const API_BASE = `${config.apiUrl}/api/v1`;
