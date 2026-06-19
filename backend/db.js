import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists (for fallback JSON mode)
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SONGS_FILE = path.join(DATA_DIR, 'songs.json');
const FRIENDSHIPS_FILE = path.join(DATA_DIR, 'friendships.json');

// --- JSON FALLBACK STORAGE HELPERS ---
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

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
  }
}

// --- MONGODB CONNECTION MANAGER ---
let mongoClient = null;
let mongoDb = null;

async function getMongoDb() {
  if (mongoDb) return mongoDb;
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is missing.');
  }
  mongoClient = new MongoClient(process.env.MONGODB_URI);
  await mongoClient.connect();
  mongoDb = mongoClient.db(); // Default database from connection string
  return mongoDb;
}

// Check if we should use MongoDB or local JSON files
const isMongoMode = () => !!process.env.MONGODB_URI;

export const db = {
  // --- USERS ---
  getUserById: async (id) => {
    if (isMongoMode()) {
      const dbInstance = await getMongoDb();
      return await dbInstance.collection('users').findOne({ id });
    } else {
      return readJsonFile(USERS_FILE).find(u => u.id === id);
    }
  },

  getUserByUsername: async (username) => {
    const usernameLower = username.toLowerCase();
    if (isMongoMode()) {
      const dbInstance = await getMongoDb();
      // Case insensitive search
      return await dbInstance.collection('users').findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') } 
      });
    } else {
      return readJsonFile(USERS_FILE).find(u => u.username.toLowerCase() === usernameLower);
    }
  },

  createUser: async (username, passwordHash) => {
    const newUser = {
      id: Math.random().toString(36).substring(2, 9),
      username,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    if (isMongoMode()) {
      const dbInstance = await getMongoDb();
      await dbInstance.collection('users').insertOne(newUser);
    } else {
      const users = readJsonFile(USERS_FILE);
      users.push(newUser);
      writeJsonFile(USERS_FILE, users);
    }
    return newUser;
  },

  // --- SONGS ---
  getUserSongs: async (userId) => {
    if (isMongoMode()) {
      const dbInstance = await getMongoDb();
      return await dbInstance.collection('songs').find({ userId }).toArray();
    } else {
      return readJsonFile(SONGS_FILE).filter(s => s.userId === userId);
    }
  },

  getUserSongForDate: async (userId, date) => {
    if (isMongoMode()) {
      const dbInstance = await getMongoDb();
      return await dbInstance.collection('songs').findOne({ userId, date });
    } else {
      return readJsonFile(SONGS_FILE).find(s => s.userId === userId && s.date === date);
    }
  },

  setSongForDate: async (userId, date, songData) => {
    const songRecord = {
      id: Math.random().toString(36).substring(2, 9),
      userId,
      date,
      videoId: songData.videoId,
      title: songData.title,
      channelTitle: songData.channelTitle,
      thumbnail: songData.thumbnail,
      note: songData.note || '',
      updatedAt: new Date().toISOString()
    };

    if (isMongoMode()) {
      const dbInstance = await getMongoDb();
      await dbInstance.collection('songs').updateOne(
        { userId, date },
        { $set: songRecord },
        { upsert: true }
      );
    } else {
      const songs = readJsonFile(SONGS_FILE);
      const existingIndex = songs.findIndex(s => s.userId === userId && s.date === date);
      if (existingIndex > -1) {
        songs[existingIndex] = { ...songs[existingIndex], ...songRecord };
      } else {
        songs.push(songRecord);
      }
      writeJsonFile(SONGS_FILE, songs);
    }
    return songRecord;
  },

  deleteSongForDate: async (userId, date) => {
    if (isMongoMode()) {
      const dbInstance = await getMongoDb();
      await dbInstance.collection('songs').deleteOne({ userId, date });
    } else {
      let songs = readJsonFile(SONGS_FILE);
      songs = songs.filter(s => !(s.userId === userId && s.date === date));
      writeJsonFile(SONGS_FILE, songs);
    }
  },

  // --- FRIENDSHIPS ---
  sendFriendRequest: async (requesterId, receiverId) => {
    if (isMongoMode()) {
      const dbInstance = await getMongoDb();
      // Check if relationship already exists
      const existing = await dbInstance.collection('friendships').findOne({
        $or: [
          { requesterId, receiverId },
          { requesterId: receiverId, receiverId: requesterId }
        ]
      });
      if (existing) return existing;

      const newFriendship = {
        id: Math.random().toString(36).substring(2, 9),
        requesterId,
        receiverId,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await dbInstance.collection('friendships').insertOne(newFriendship);
      return newFriendship;
    } else {
      const friendships = readJsonFile(FRIENDSHIPS_FILE);
      const existing = friendships.find(f => 
        (f.requesterId === requesterId && f.receiverId === receiverId) ||
        (f.requesterId === receiverId && f.receiverId === requesterId)
      );
      if (existing) return existing;

      const newFriendship = {
        id: Math.random().toString(36).substring(2, 9),
        requesterId,
        receiverId,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      friendships.push(newFriendship);
      writeJsonFile(FRIENDSHIPS_FILE, friendships);
      return newFriendship;
    }
  },

  acceptFriendRequest: async (friendshipId, receiverId) => {
    if (isMongoMode()) {
      const dbInstance = await getMongoDb();
      await dbInstance.collection('friendships').updateOne(
        { id: friendshipId, receiverId },
        { $set: { status: 'accepted', acceptedAt: new Date().toISOString() } }
      );
      return await dbInstance.collection('friendships').findOne({ id: friendshipId });
    } else {
      const friendships = readJsonFile(FRIENDSHIPS_FILE);
      const fIndex = friendships.findIndex(f => f.id === friendshipId && f.receiverId === receiverId);
      if (fIndex > -1) {
        friendships[fIndex].status = 'accepted';
        friendships[fIndex].acceptedAt = new Date().toISOString();
        writeJsonFile(FRIENDSHIPS_FILE, friendships);
        return friendships[fIndex];
      }
      return null;
    }
  },

  declineOrCancelFriendship: async (friendshipId, userId) => {
    if (isMongoMode()) {
      const dbInstance = await getMongoDb();
      const res = await dbInstance.collection('friendships').deleteOne({
        id: friendshipId,
        $or: [
          { requesterId: userId },
          { receiverId: userId }
        ]
      });
      return res.deletedCount > 0;
    } else {
      let friendships = readJsonFile(FRIENDSHIPS_FILE);
      const existing = friendships.find(f => f.id === friendshipId);
      if (existing && (existing.requesterId === userId || existing.receiverId === userId)) {
        friendships = friendships.filter(f => f.id !== friendshipId);
        writeJsonFile(FRIENDSHIPS_FILE, friendships);
        return true;
      }
      return false;
    }
  },

  getFriends: async (userId) => {
    if (isMongoMode()) {
      const dbInstance = await getMongoDb();
      const friendships = await dbInstance.collection('friendships').find({
        status: 'accepted',
        $or: [
          { requesterId: userId },
          { receiverId: userId }
        ]
      }).toArray();
      const users = await dbInstance.collection('users').find({}).toArray();

      return friendships.map(f => {
        const friendId = f.requesterId === userId ? f.receiverId : f.requesterId;
        const friendUser = users.find(u => u.id === friendId);
        return {
          friendshipId: f.id,
          id: friendId,
          username: friendUser ? friendUser.username : 'Unknown User',
          acceptedAt: f.acceptedAt
        };
      });
    } else {
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
    }
  },

  getPendingRequests: async (userId) => {
    if (isMongoMode()) {
      const dbInstance = await getMongoDb();
      const friendships = await dbInstance.collection('friendships').find({
        status: 'pending',
        $or: [
          { requesterId: userId },
          { receiverId: userId }
        ]
      }).toArray();
      const users = await dbInstance.collection('users').find({}).toArray();

      const incoming = friendships.filter(f => f.receiverId === userId).map(f => {
        const requester = users.find(u => u.id === f.requesterId);
        return {
          friendshipId: f.id,
          id: f.requesterId,
          username: requester ? requester.username : 'Unknown User',
          createdAt: f.createdAt,
          type: 'incoming'
        };
      });

      const outgoing = friendships.filter(f => f.requesterId === userId).map(f => {
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
    } else {
      const friendships = readJsonFile(FRIENDSHIPS_FILE);
      const users = readJsonFile(USERS_FILE);

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
    }
  },

  areFriends: async (user1Id, user2Id) => {
    if (user1Id === user2Id) return true;
    if (isMongoMode()) {
      const dbInstance = await getMongoDb();
      const friendship = await dbInstance.collection('friendships').findOne({
        status: 'accepted',
        $or: [
          { requesterId: user1Id, receiverId: user2Id },
          { requesterId: user2Id, receiverId: user1Id }
        ]
      });
      return !!friendship;
    } else {
      const friendships = readJsonFile(FRIENDSHIPS_FILE);
      return friendships.some(f => 
        f.status === 'accepted' && (
          (f.requesterId === user1Id && f.receiverId === user2Id) ||
          (f.requesterId === user2Id && f.receiverId === user1Id)
        )
      );
    }
  }
};
