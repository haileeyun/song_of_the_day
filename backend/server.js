import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'song-of-the-day-super-secret-key-1337';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

app.use(cors());
app.use(express.json());

// Middleware: Authenticate user
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// --- AUTH ENDPOINTS ---

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (username.length < 3 || password.length < 4) {
      return res.status(400).json({ error: 'Username must be at least 3 characters and password at least 4 characters.' });
    }

    const existingUser = db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = db.createUser(username, passwordHash);

    const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: newUser.id, username: newUser.username } });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Get current user profile
app.get('/api/auth/me', authenticate, (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ id: user.id, username: user.username });
});

// --- YOUTUBE SEARCH ENDPOINT ---

app.get('/api/songs/search', authenticate, async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Search query parameter "q" is required.' });
  }

  if (!YOUTUBE_API_KEY) {
    // Return a flag indicating the API key is missing, plus mock songs for a quick demo
    const mockSongs = [
      {
        videoId: 'dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up (Mock Result)',
        channelTitle: 'Rick Astley',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
      },
      {
        videoId: 'L_LUpnjgPso',
        title: 'Lofi Girl - Lofi Hip Hop Radio - Beats to Relax/Study to (Mock Result)',
        channelTitle: 'Lofi Girl',
        thumbnail: 'https://i.ytimg.com/vi/L_LUpnjgPso/mqdefault.jpg'
      },
      {
        videoId: 'fLexgOxsZu0',
        title: 'Bruno Mars - Uptown Funk (Mock Result)',
        channelTitle: 'Bruno Mars',
        thumbnail: 'https://i.ytimg.com/vi/fLexgOxsZu0/mqdefault.jpg'
      },
      {
        videoId: 'kJQP7kiw5Fk',
        title: 'Luis Fonsi - Despacito ft. Daddy Yankee (Mock Result)',
        channelTitle: 'Luis Fonsi',
        thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg'
      },
      {
        videoId: '9bZkp7q19f0',
        title: 'PSY - GANGNAM STYLE (Mock Result)',
        channelTitle: 'PSY',
        thumbnail: 'https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg'
      }
    ].filter(s => s.title.toLowerCase().includes(query.toLowerCase()) || s.channelTitle.toLowerCase().includes(query.toLowerCase()));

    return res.json({
      youtubeApiKeyMissing: true,
      results: mockSongs.length > 0 ? mockSongs : [
        {
          videoId: 'dQw4w9WgXcQ',
          title: `Rick Astley - Never Gonna Give You Up (No results found for "${query}" - setup API Key!)`,
          channelTitle: 'Rick Astley',
          thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
        }
      ]
    });
  }

  try {
    // Search using YouTube Data API v3
    // Search is limited to video type. Adding videoCategoryId=10 might filter out non-categorized music content,
    // so we search for general video type and append "song" or "music" or just search general. Let's do general video search.
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.append('part', 'snippet');
    url.searchParams.append('type', 'video');
    url.searchParams.append('q', query);
    url.searchParams.append('key', YOUTUBE_API_KEY);
    url.searchParams.append('maxResults', '8');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.error) {
      console.error('YouTube API error details:', data.error);
      return res.status(data.error.code || 500).json({ 
        error: `YouTube API Error: ${data.error.message}`,
        youtubeApiKeyMissing: false 
      });
    }

    const results = (data.items || []).map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || ''
    }));

    res.json({ youtubeApiKeyMissing: false, results });
  } catch (err) {
    console.error('YouTube search fetch error:', err);
    res.status(500).json({ error: 'Failed to search YouTube API.' });
  }
});

// --- SONG CALENDAR ENDPOINTS ---

// Get songs of the current user for all time (or query parameters can filter)
app.get('/api/songs', authenticate, (req, res) => {
  const songs = db.getUserSongs(req.user.id);
  res.json(songs);
});

// Get songs of a specific friend (only if friends)
app.get('/api/songs/friend/:friendId', authenticate, (req, res) => {
  const { friendId } = req.params;
  
  if (!db.areFriends(req.user.id, friendId)) {
    return res.status(403).json({ error: 'You must be friends with this user to view their calendar.' });
  }

  const songs = db.getUserSongs(friendId);
  res.json(songs);
});

// Set song for a specific date (YYYY-MM-DD)
app.post('/api/songs', authenticate, (req, res) => {
  const { date, videoId, title, channelTitle, thumbnail, note } = req.body;
  if (!date || !videoId || !title) {
    return res.status(400).json({ error: 'Missing date, videoId, or title parameters.' });
  }

  // Basic format validation: YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' });
  }

  const songRecord = db.setSongForDate(req.user.id, date, {
    videoId,
    title,
    channelTitle,
    thumbnail,
    note
  });

  res.json(songRecord);
});

// Delete song of a specific date (YYYY-MM-DD)
app.delete('/api/songs', authenticate, (req, res) => {
  const { date } = req.body;
  if (!date) {
    return res.status(400).json({ error: 'Missing date parameter.' });
  }

  db.deleteSongForDate(req.user.id, date);
  res.json({ success: true, message: `Deleted song for ${date}` });
});

// --- FRIENDSHIP ENDPOINTS ---

// Get all friends and pending requests
app.get('/api/friends', authenticate, (req, res) => {
  const userId = req.user.id;
  const friends = db.getFriends(userId);
  const { incoming, outgoing } = db.getPendingRequests(userId);
  
  res.json({ friends, pendingIncoming: incoming, pendingOutgoing: outgoing });
});

// Send a friend request (by searching username)
app.post('/api/friends/request', authenticate, (req, res) => {
  const { friendUsername } = req.body;
  if (!friendUsername) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  if (friendUsername.toLowerCase() === req.user.username.toLowerCase()) {
    return res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
  }

  const targetUser = db.getUserByUsername(friendUsername);
  if (!targetUser) {
    return res.status(444).json({ error: `User "${friendUsername}" not found.` }); // Custom status code to identify "user not found" specifically
  }

  const friendship = db.sendFriendRequest(req.user.id, targetUser.id);
  res.json(friendship);
});

// Accept a friend request
app.post('/api/friends/accept', authenticate, (req, res) => {
  const { friendshipId } = req.body;
  if (!friendshipId) {
    return res.status(400).json({ error: 'Missing friendshipId.' });
  }

  const result = db.acceptFriendRequest(friendshipId, req.user.id);
  if (!result) {
    return res.status(400).json({ error: 'Invalid friend request or not authorized to accept.' });
  }

  res.json(result);
});

// Decline a request or remove a friend
app.post('/api/friends/remove', authenticate, (req, res) => {
  const { friendshipId } = req.body;
  if (!friendshipId) {
    return res.status(400).json({ error: 'Missing friendshipId.' });
  }

  const success = db.declineOrCancelFriendship(friendshipId, req.user.id);
  if (!success) {
    return res.status(400).json({ error: 'Could not remove friendship or friendship does not exist.' });
  }

  res.json({ success: true, message: 'Friendship request/status updated.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
