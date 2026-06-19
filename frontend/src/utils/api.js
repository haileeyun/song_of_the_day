const TOKEN_KEY = 'song_of_the_day_token';

export const api = {
  setToken: (token) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  },

  getToken: () => {
    return localStorage.getItem(TOKEN_KEY);
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
  },

  fetchApi: async (endpoint, options = {}) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const config = {
      ...options,
      headers,
    };

    const response = await fetch(endpoint, config);
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Something went wrong');
      error.status = response.status;
      error.youtubeApiKeyMissing = data.youtubeApiKeyMissing || false;
      throw error;
    }

    return data;
  },

  // Auth
  login: async (username, password) => {
    const data = await api.fetchApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    api.setToken(data.token);
    return data.user;
  },

  register: async (username, password) => {
    const data = await api.fetchApi('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    api.setToken(data.token);
    return data.user;
  },

  getMe: async () => {
    return api.fetchApi('/api/auth/me');
  },

  // Songs
  getSongs: async () => {
    return api.fetchApi('/api/songs');
  },

  getFriendSongs: async (friendId) => {
    return api.fetchApi(`/api/songs/friend/${friendId}`);
  },

  setSong: async (songData) => {
    return api.fetchApi('/api/songs', {
      method: 'POST',
      body: JSON.stringify(songData),
    });
  },

  deleteSong: async (date) => {
    return api.fetchApi('/api/songs', {
      method: 'DELETE',
      body: JSON.stringify({ date }),
    });
  },

  searchSongs: async (query) => {
    return api.fetchApi(`/api/songs/search?q=${encodeURIComponent(query)}`);
  },

  // Friends
  getFriends: async () => {
    return api.fetchApi('/api/friends');
  },

  sendFriendRequest: async (friendUsername) => {
    return api.fetchApi('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ friendUsername }),
    });
  },

  acceptFriendRequest: async (friendshipId) => {
    return api.fetchApi('/api/friends/accept', {
      method: 'POST',
      body: JSON.stringify({ friendshipId }),
    });
  },

  removeFriendship: async (friendshipId) => {
    return api.fetchApi('/api/friends/remove', {
      method: 'POST',
      body: JSON.stringify({ friendshipId }),
    });
  }
};
