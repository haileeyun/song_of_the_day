import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let supabaseInstance = null;

function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be provided in environment variables.');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey);
  return supabaseInstance;
}

export const db = {
  // --- USERS ---
  getUserById: async (id) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  getUserByUsername: async (username) => {
    if (!username) return null;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('username', username)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  createUser: async (username, passwordHash) => {
    const supabase = getSupabase();
    const newUser = {
      id: Math.random().toString(36).substring(2, 9),
      username,
      passwordHash,
      createdAt: new Date().toISOString()
    };
    const { error } = await supabase
      .from('users')
      .insert(newUser);
    if (error) throw error;
    return newUser;
  },

  // --- SONGS ---
  getUserSongs: async (userId) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('userId', userId);
    if (error) throw error;
    return data || [];
  },

  getUserSongForDate: async (userId, date) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('userId', userId)
      .eq('date', date)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  setSongForDate: async (userId, date, songData) => {
    const supabase = getSupabase();
    const existing = await db.getUserSongForDate(userId, date);

    const songRecord = {
      id: existing ? existing.id : Math.random().toString(36).substring(2, 9),
      userId,
      date,
      videoId: songData.videoId,
      title: songData.title,
      channelTitle: songData.channelTitle,
      thumbnail: songData.thumbnail,
      note: songData.note || '',
      updatedAt: new Date().toISOString()
    };

    const { error } = await supabase
      .from('songs')
      .upsert(songRecord, { onConflict: 'userId,date' });
    if (error) throw error;
    return songRecord;
  },

  deleteSongForDate: async (userId, date) => {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('userId', userId)
      .eq('date', date);
    if (error) throw error;
  },

  // --- FRIENDSHIPS ---
  sendFriendRequest: async (requesterId, receiverId) => {
    const supabase = getSupabase();
    // Retrieve any friendship between these two users
    const { data, error: fError } = await supabase
      .from('friendships')
      .select('*')
      .or(`requesterId.eq.${requesterId},receiverId.eq.${requesterId}`);
    if (fError) throw fError;

    const existing = (data || []).find(f => 
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

    const { error } = await supabase
      .from('friendships')
      .insert(newFriendship);
    if (error) throw error;
    return newFriendship;
  },

  acceptFriendRequest: async (friendshipId, receiverId) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', acceptedAt: new Date().toISOString() })
      .eq('id', friendshipId)
      .eq('receiverId', receiverId)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  declineOrCancelFriendship: async (friendshipId, userId) => {
    const supabase = getSupabase();
    // Get friendship first to verify ownership
    const { data: existing, error: getError } = await supabase
      .from('friendships')
      .select('*')
      .eq('id', friendshipId)
      .maybeSingle();
    if (getError) throw getError;

    if (existing && (existing.requesterId === userId || existing.receiverId === userId)) {
      const { error: deleteError } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);
      if (deleteError) throw deleteError;
      return true;
    }
    return false;
  },

  getFriends: async (userId) => {
    const supabase = getSupabase();
    const { data: friendships, error: fError } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', 'accepted')
      .or(`requesterId.eq.${userId},receiverId.eq.${userId}`);
    if (fError) throw fError;

    if (!friendships || friendships.length === 0) return [];

    const friendIds = friendships.map(f => f.requesterId === userId ? f.receiverId : f.requesterId);

    const { data: users, error: uError } = await supabase
      .from('users')
      .select('id, username')
      .in('id', friendIds);
    if (uError) throw uError;

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
  },

  getPendingRequests: async (userId) => {
    const supabase = getSupabase();
    const { data: friendships, error: fError } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', 'pending')
      .or(`requesterId.eq.${userId},receiverId.eq.${userId}`);
    if (fError) throw fError;

    if (!friendships || friendships.length === 0) {
      return { incoming: [], outgoing: [] };
    }

    const userIds = friendships.map(f => f.requesterId === userId ? f.receiverId : f.requesterId);

    const { data: users, error: uError } = await supabase
      .from('users')
      .select('id, username')
      .in('id', userIds);
    if (uError) throw uError;

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
  },

  areFriends: async (user1Id, user2Id) => {
    if (user1Id === user2Id) return true;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', 'accepted')
      .or(`requesterId.eq.${user1Id},receiverId.eq.${user1Id}`);
    if (error) throw error;
    return (data || []).some(f => f.requesterId === user2Id || f.receiverId === user2Id);
  }
};
