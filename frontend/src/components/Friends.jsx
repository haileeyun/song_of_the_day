import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Friends({ onViewFriendCalendar, addToast }) {
  const [friendsData, setFriendsData] = useState({
    friends: [],
    pendingIncoming: [],
    pendingOutgoing: []
  });
  const [searchUsername, setSearchUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const fetchFriends = async () => {
    setIsLoading(true);
    try {
      const data = await api.getFriends();
      setFriendsData(data);
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Error loading friends list.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;

    setIsSearching(true);
    try {
      await api.sendFriendRequest(searchUsername);
      addToast(`Friend request sent to "${searchUsername}"!`, 'success');
      setSearchUsername('');
      fetchFriends();
    } catch (err) {
      console.error(err);
      if (err.status === 444) {
        addToast(`User "${searchUsername}" does not exist.`, 'error');
      } else {
        addToast(err.message || 'Error sending friend request.', 'error');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleAcceptRequest = async (friendshipId, friendName) => {
    try {
      await api.acceptFriendRequest(friendshipId);
      addToast(`You are now friends with ${friendName}!`, 'success');
      fetchFriends();
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Error accepting friend request.', 'error');
    }
  };

  const handleRemoveFriendship = async (friendshipId, friendName, actionType) => {
    const confirmMsg = actionType === 'friend' 
      ? `Are you sure you want to remove ${friendName} from your friends?`
      : `Are you sure you want to cancel the request to ${friendName}?`;
      
    if (window.confirm(confirmMsg)) {
      try {
        await api.removeFriendship(friendshipId);
        addToast('Relationship updated successfully.', 'info');
        fetchFriends();
      } catch (err) {
        console.error(err);
        addToast(err.message || 'Error updating friendship status.', 'error');
      }
    }
  };

  return (
    <div className="glass-panel">
      <h2 style={{ fontSize: '1.8rem', marginBottom: '1.5rem', background: 'linear-gradient(to right, #fff, #c8b7e2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Friends & Social
      </h2>

      <div className="friends-layout">
        {/* Left Side: Add Friends & Pending */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Add Friend Form */}
          <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: 0, background: 'rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Add Friend</h3>
            <form onSubmit={handleSendRequest} className="search-input-container">
              <input
                type="text"
                className="form-control"
                placeholder="Enter friend's username..."
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                disabled={isSearching}
              />
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isSearching}
              >
                {isSearching ? 'Sending...' : 'Add'}
              </button>
            </form>
          </div>

          {/* Pending Requests */}
          <div>
            <h3 className="friend-section-title">
              Pending Requests
              {(friendsData.pendingIncoming.length + friendsData.pendingOutgoing.length) > 0 && (
                <span>{friendsData.pendingIncoming.length + friendsData.pendingOutgoing.length}</span>
              )}
            </h3>

            {friendsData.pendingIncoming.length === 0 && friendsData.pendingOutgoing.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                No pending friend requests.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Incoming Requests */}
                {friendsData.pendingIncoming.map((req) => (
                  <div key={req.friendshipId} className="friend-item" style={{ borderLeft: '3px solid var(--color-primary)' }}>
                    <div className="friend-info">
                      <div className="friend-avatar">
                        {req.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="friend-name">{req.username}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>wants to be friends</div>
                      </div>
                    </div>
                    <div className="friend-actions">
                      <button 
                        className="btn btn-primary" 
                        onClick={() => handleAcceptRequest(req.friendshipId, req.username)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Accept
                      </button>
                      <button 
                        className="btn btn-danger" 
                        onClick={() => handleRemoveFriendship(req.friendshipId, req.username, 'incoming')}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}

                {/* Outgoing Requests */}
                {friendsData.pendingOutgoing.map((req) => (
                  <div key={req.friendshipId} className="friend-item" style={{ opacity: 0.8 }}>
                    <div className="friend-info">
                      <div className="friend-avatar" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                        {req.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="friend-name">{req.username}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>pending response</div>
                      </div>
                    </div>
                    <div className="friend-actions">
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleRemoveFriendship(req.friendshipId, req.username, 'outgoing')}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active Friends List */}
        <div>
          <h3 className="friend-section-title">
            My Friends
            {friendsData.friends.length > 0 && <span>{friendsData.friends.length}</span>}
          </h3>

          {isLoading && friendsData.friends.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading friends list...</p>
          ) : friendsData.friends.length === 0 ? (
            <div className="empty-state" style={{ background: 'rgba(0,0,0,0.1)', borderRadius: '16px' }}>
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-title">No Friends Yet</div>
              <p>Add friends by their username to view each other's music calendars!</p>
            </div>
          ) : (
            <div className="friends-list">
              {friendsData.friends.map((friend) => (
                <div key={friend.friendshipId} className="friend-item">
                  <div 
                    className="friend-info" 
                    onClick={() => onViewFriendCalendar(friend)}
                    title="Click to view calendar"
                  >
                    <div className="friend-avatar">
                      {friend.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="friend-name">{friend.username}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        View Music Calendar
                      </div>
                    </div>
                  </div>
                  <div className="friend-actions">
                    <button 
                      className="btn btn-secondary"
                      onClick={() => onViewFriendCalendar(friend)}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    >
                      View Calendar
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => handleRemoveFriendship(friend.friendshipId, friend.username, 'friend')}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
