import React, { useState, useEffect } from 'react';
import { api } from './utils/api';
import Login from './components/Login';
import Calendar from './components/Calendar';
import Friends from './components/Friends';
import SongModal from './components/SongModal';


export default function App() {
  const [user, setUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [activeTab, setActiveTab] = useState('my-calendar'); // my-calendar, friends, friend-calendar
  
  // Songs on the currently displayed calendar
  const [songs, setSongs] = useState([]);
  const [friendToView, setFriendToView] = useState(null);
  
  // Modal state
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);

  // Toast notifications state
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = api.getToken();
      if (!token) {
        setIsLoadingUser(false);
        return;
      }

      try {
        const profile = await api.getMe();
        setUser(profile);
      } catch (err) {
        console.error('Session validation failed:', err);
        api.logout();
      } finally {
        setIsLoadingUser(false);
      }
    };

    checkAuth();
  }, []);

  // Fetch songs when user or active view changes
  useEffect(() => {
    if (!user) {
      setSongs([]);
      return;
    }

    const fetchSongsData = async () => {
      try {
        if (activeTab === 'my-calendar') {
          const data = await api.getSongs();
          setSongs(data);
        } else if (activeTab === 'friend-calendar' && friendToView) {
          const data = await api.getFriendSongs(friendToView.id);
          setSongs(data);
        }
      } catch (err) {
        console.error(err);
        addToast(err.message || 'Failed to fetch calendar songs.', 'error');
        // Fall back to my-calendar if friend-calendar load fails
        if (activeTab === 'friend-calendar') {
          setActiveTab('my-calendar');
          setFriendToView(null);
        }
      }
    };

    fetchSongsData();
  }, [user, activeTab, friendToView]);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setActiveTab('my-calendar');
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setActiveTab('my-calendar');
    setFriendToView(null);
    setSongs([]);
    addToast('Signed out successfully.', 'info');
  };

  const handleDateClick = (dateStr, songData) => {
    setSelectedDate(dateStr);
    setSelectedSong(songData || null);
  };

  // Handle local song updates after saving in modal
  const handleSaveSong = (savedSong) => {
    setSongs(prev => {
      const existsIndex = prev.findIndex(s => s.date === savedSong.date);
      if (existsIndex > -1) {
        const updated = [...prev];
        updated[existsIndex] = savedSong;
        return updated;
      }
      return [...prev, savedSong];
    });
  };

  // Handle local song deletion after removing in modal
  const handleDeleteSong = (dateStr) => {
    setSongs(prev => prev.filter(s => s.date !== dateStr));
  };

  const handleViewFriendCalendar = (friend) => {
    setFriendToView(friend);
    setActiveTab('friend-calendar');
  };

  if (isLoadingUser) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="logo-icon" style={{ margin: '0 auto 1.25rem auto' }}>🎵</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>Tuning the radio...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">

      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`} onClick={() => removeToast(toast.id)}>
            <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
            <div style={{ flex: 1 }}>{toast.message}</div>
          </div>
        ))}
      </div>

      <header>
        <div className="logo-container">
          <div className="logo-icon">🎵</div>
          <h1 className="logo-text">Song of the Day</h1>
        </div>

        {user && (
          <div className="nav-user">
            <span className="user-badge">@{user.username}</span>
            <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              Sign Out
            </button>
          </div>
        )}
      </header>

      <main className="main-content">
        {!user ? (
          <Login onLoginSuccess={handleLoginSuccess} addToast={addToast} />
        ) : (
          <div>
            <div className="dashboard-header">
              <h2 className="dashboard-title">
                {activeTab === 'my-calendar' && 'My Calendar'}
                {activeTab === 'friends' && 'Social Hub'}
                {activeTab === 'friend-calendar' && `${friendToView?.username}'s Calendar`}
              </h2>

              <div className="dashboard-tabs">
                <button 
                  className={`tab-btn ${activeTab === 'my-calendar' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('my-calendar');
                    setFriendToView(null);
                  }}
                >
                  🗓️ My Calendar
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
                  onClick={() => setActiveTab('friends')}
                >
                  👥 Friends
                </button>
                {activeTab === 'friend-calendar' && friendToView && (
                  <button className="tab-btn active">
                    🎵 {friendToView.username}
                  </button>
                )}
              </div>
            </div>

            {activeTab === 'my-calendar' && (
              <Calendar 
                songs={songs} 
                onDateClick={handleDateClick} 
                isReadOnly={false} 
              />
            )}

            {activeTab === 'friend-calendar' && friendToView && (
              <Calendar 
                songs={songs} 
                onDateClick={handleDateClick} 
                isReadOnly={true}
                viewOwnerName={friendToView.username}
              />
            )}

            {activeTab === 'friends' && (
              <Friends 
                onViewFriendCalendar={handleViewFriendCalendar} 
                addToast={addToast} 
              />
            )}
          </div>
        )}
      </main>

      {/* Song Add/Edit/View Detail Modal */}
      {selectedDate && (
        <SongModal
          date={selectedDate}
          song={selectedSong}
          onClose={() => {
            setSelectedDate(null);
            setSelectedSong(null);
          }}
          onSave={handleSaveSong}
          onDelete={handleDeleteSong}
          isReadOnly={activeTab === 'friend-calendar'}
          addToast={addToast}
        />
      )}
    </div>
  );
}
