import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SONGS_FILE = path.join(DATA_DIR, 'songs.json');
const FRIENDSHIPS_FILE = path.join(DATA_DIR, 'friendships.json');

// Helper to read JSON file or return default
function readJsonFile(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data || JSON.stringify(defaultValue));
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

// Helper to write JSON file
function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
  }
}

export const db = {
  // Users
  getUsers: () => readJsonFile(USERS_FILE),
  saveUsers: (users) => writeJsonFile(USERS_FILE, users),
  getUserById: (id) => readJsonFile(USERS_FILE).find(u => u.id === id),
  getUserByUsername: (username) => {
    const usernameLower = username.toLowerCase();
    return readJsonFile(USERS_FILE).find(u => u.username.toLowerCase() === usernameLower);
  },
  createUser: (username, passwordHash) => {
    const users = readJsonFile(USERS_FILE);
    const newUser = {
      id: Math.random().toString(36).substring(2, 9),
      username,
      passwordHash,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    writeJsonFile(USERS_FILE, users);
    return newUser;
  },

  // Songs
  getSongs: () => readJsonFile(SONGS_FILE),
  saveSongs: (songs) => writeJsonFile(SONGS_FILE, songs),
  getUserSongs: (userId) => readJsonFile(SONGS_FILE).filter(s => s.userId === userId),
  getUserSongForDate: (userId, date) => {
    return readJsonFile(SONGS_FILE).find(s => s.userId === userId && s.date === date);
  },
  setSongForDate: (userId, date, songData) => {
    const songs = readJsonFile(SONGS_FILE);
    const existingIndex = songs.findIndex(s => s.userId === userId && s.date === date);

    const songRecord = {
      id: Math.random().toString(36).substring(2, 9),
      userId,
      date, // YYYY-MM-DD
      videoId: songData.videoId,
      title: songData.title,
      channelTitle: songData.channelTitle,
      thumbnail: songData.thumbnail,
      note: songData.note || '', // Optional comment/note from the user about the song
      updatedAt: new Date().toISOString()
    };

    if (existingIndex > -1) {
      songs[existingIndex] = { ...songs[existingIndex], ...songRecord };
    } else {
      songs.push(songRecord);
    }

    writeJsonFile(SONGS_FILE, songs);
    return songRecord;
  },
  deleteSongForDate: (userId, date) => {
    let songs = readJsonFile(SONGS_FILE);
    songs = songs.filter(s => !(s.userId === userId && s.date === date));
    writeJsonFile(SONGS_FILE, songs);
  },

  // Friendships
  getFriendships: () => readJsonFile(FRIENDSHIPS_FILE),
  saveFriendships: (friendships) => writeJsonFile(FRIENDSHIPS_FILE, friendships),
  
  sendFriendRequest: (requesterId, receiverId) => {
    const friendships = readJsonFile(FRIENDSHIPS_FILE);
    
    // Check if relationship already exists
    const existing = friendships.find(f => 
      (f.requesterId === requesterId && f.receiverId === receiverId) ||
      (f.requesterId === receiverId && f.receiverId === requesterId)
    );
    
    if (existing) {
      return existing;
    }

    const newFriendship = {
      id: Math.random().toString(36).substring(2, 9),
      requesterId,
      receiverId,
      status: 'pending', // pending, accepted
      createdAt: new Date().toISOString()
    };

    friendships.push(newFriendship);
    writeJsonFile(FRIENDSHIPS_FILE, friendships);
    return newFriendship;
  },

  acceptFriendRequest: (friendshipId, receiverId) => {
    const friendships = readJsonFile(FRIENDSHIPS_FILE);
    const fIndex = friendships.findIndex(f => f.id === friendshipId && f.receiverId === receiverId);
    
    if (fIndex > -1) {
      friendships[fIndex].status = 'accepted';
      friendships[fIndex].acceptedAt = new Date().toISOString();
      writeJsonFile(FRIENDSHIPS_FILE, friendships);
      return friendships[fIndex];
    }
    return null;
  },

  declineOrCancelFriendship: (friendshipId, userId) => {
    let friendships = readJsonFile(FRIENDSHIPS_FILE);
    const existing = friendships.find(f => f.id === friendshipId);
    if (existing && (existing.requesterId === userId || existing.receiverId === userId)) {
      friendships = friendships.filter(f => f.id !== friendshipId);
      writeJsonFile(FRIENDSHIPS_FILE, friendships);
      return true;
    }
    return false;
  },

  getFriends: (userId) => {
    const friendships = readJsonFile(FRIENDSHIPS_FILE);
    const users = readJsonFile(USERS_FILE);
    
    const acceptedFriendships = friendships.filter(f => 
      f.status === 'accepted' && (f.requesterId === userId || f.receiverId === userId)
    );

    return acceptedFriendships.map(f => {
      const friendId = f.requesterId === userId ? f.receiverId : f.requesterId;
      const friendUser = users.find(u => u.id === friendId);
      return {
        friendshipId: f.id,
        id: friendId,
        username: friendUser ? friendUser.username : 'Unknown User',
        acceptedAt: f.acceptedAt
      };
    });
  },

  getPendingRequests: (userId) => {
    const friendships = readJsonFile(FRIENDSHIPS_FILE);
    const users = readJsonFile(USERS_FILE);

    // Incoming requests (waiting for current user to accept)
    const incoming = friendships.filter(f => f.status === 'pending' && f.receiverId === userId).map(f => {
      const requester = users.find(u => u.id === f.requesterId);
      return {
        friendshipId: f.id,
        id: f.requesterId,
        username: requester ? requester.username : 'Unknown User',
        createdAt: f.createdAt,
        type: 'incoming'
      };
    });

    // Outgoing requests (waiting for friend to accept)
    const outgoing = friendships.filter(f => f.status === 'pending' && f.requesterId === userId).map(f => {
      const receiver = users.find(u => u.id === f.receiverId);
      return {
        friendshipId: f.id,
        id: f.receiverId,
        username: receiver ? receiver.username : 'Unknown User',
        createdAt: f.createdAt,
        type: 'outgoing'
      };
    });

    return { incoming, outgoing };
  },

  areFriends: (user1Id, user2Id) => {
    if (user1Id === user2Id) return true;
    const friendships = readJsonFile(FRIENDSHIPS_FILE);
    return friendships.some(f => 
      f.status === 'accepted' && (
        (f.requesterId === user1Id && f.receiverId === user2Id) ||
        (f.requesterId === user2Id && f.receiverId === user1Id)
      )
    );
  }
};
