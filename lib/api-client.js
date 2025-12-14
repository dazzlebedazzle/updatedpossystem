// API client utility for making authenticated requests with Bearer token

/**
 * Get the JWT token from cookie or localStorage
 * @returns {string|null} - JWT token or null
 */
export function getAuthToken() {
  // Try to get from localStorage first
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken');
    if (token) return token;
    
    // Try to get from cookie
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
    if (tokenCookie) {
      return tokenCookie.split('=')[1];
    }
  }
  return null;
}

/**
 * Get the user token (agentToken, adminToken, superToken) from session
 * @returns {Promise<string|null>} - User token or null
 */
export async function getUserToken() {
  try {
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      const data = await response.json();
      return data.user?.token || null;
    }
  } catch (error) {
    console.error('Error fetching user token:', error);
  }
  return null;
}

/**
 * Make an authenticated API request with Bearer token
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
export async function authenticatedFetch(url, options = {}) {
  const token = getAuthToken();
  const userToken = await getUserToken();
  
  // Use JWT token if available, otherwise use user token
  const bearerToken = token || userToken;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Add Bearer token if available
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies as fallback
  });
}

/**
 * Store auth token in localStorage
 * @param {string} token - JWT token to store
 */
export function setAuthToken(token) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', token);
  }
}

/**
 * Remove auth token from localStorage
 */
export function removeAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken');
  }
}

