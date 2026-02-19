import axios from 'axios';

// VITE_API_URL must be the full API base including /api, e.g. http://localhost:5002/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5002/api',
});

export default api;
