import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function SongModal({ date, song, onClose, onSave, onDelete, isReadOnly, addToast }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [youtubeMissing, setYoutubeMissing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Selected song details
  const [selectedSong, setSelectedSong] = useState(null);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load existing song details when modal opens
  useEffect(() => {
    if (song) {
      setSelectedSong(song);
      setNote(song.note || '');
    } else {
      setSelectedSong(null);
      setNote('');
    }
    setSearchResults([]);
    setSearchQuery('');
  }, [song, date]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const data = await api.searchSongs(searchQuery);
      setYoutubeMissing(data.youtubeApiKeyMissing);
      setSearchResults(data.results || []);
      if (data.results?.length === 0) {
        addToast('No videos found matching that search.', 'info');
      }
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Error searching songs.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSong = (result) => {
    setSelectedSong(result);
    setSearchResults([]);
  };

  const handleSave = async () => {
    if (!selectedSong) {
      addToast('Please select a song first.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const savedSong = await api.setSong({
        date,
        videoId: selectedSong.videoId,
        title: selectedSong.title,
        channelTitle: selectedSong.channelTitle,
        thumbnail: selectedSong.thumbnail,
        note
      });
      addToast('Song of the Day saved!', 'success');
      onSave(savedSong);
      onClose();
    } catch (err) {
      addToast(err.message || 'Error saving song.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to remove the song for this day?')) {
      try {
        await api.deleteSong(date);
        addToast('Song removed from calendar.', 'success');
        onDelete(date);
        onClose();
      } catch (err) {
        addToast(err.message || 'Error deleting song.', 'error');
      }
    }
  };

  // Helper to format date label
  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const cleanTitle = (title) => {
    if (!title) return '';
    return title
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>{song ? 'Song of the Day' : 'Add Song'}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {formatDateLabel(date)}
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {isReadOnly ? (
            /* READ ONLY VIEW (Friend's Song) */
            song ? (
              <div>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                  {cleanTitle(song.title)}
                </h4>
                <p style={{ color: '#e59885', fontSize: '0.9rem', marginBottom: '1.5rem', fontWeight: 700 }}>
                  by {song.channelTitle}
                </p>

                {song.videoId && (
                  <div className="video-container">
                    <iframe
                      src={`https://www.youtube.com/embed/${song.videoId}`}
                      title={song.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                )}

                {song.note && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Friend's Note
                    </label>
                    <div className="song-note-text">
                      "{song.note}"
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🔇</div>
                <div className="empty-state-title">No Song Logged</div>
                <p>Your friend hasn't set their song of the day for this date yet.</p>
              </div>
            )
          ) : (
            /* EDIT VIEW (Current User) */
            <div>
              {/* YouTube API Setup Warning */}
              {youtubeMissing && (
                <div className="warning-banner">
                  <div>
                    ⚠️ <strong>YouTube API Key is missing.</strong> Serving mock search results. 
                    Set <code>YOUTUBE_API_KEY</code> in the <code>backend/.env</code> file to search live YouTube music.
                  </div>
                </div>
              )}

              {/* Search Box */}
              {!selectedSong && (
                <div>
                  <form onSubmit={handleSearch} className="search-wrapper">
                    <div className="search-input-container">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search for a song or artist..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={isSearching}
                      />
                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={isSearching}
                      >
                        {isSearching ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                  </form>

                  {searchResults.length > 0 && (
                    <div className="search-results-list">
                      {searchResults.map((result) => (
                        <div 
                          key={result.videoId} 
                          className="search-result-item"
                          onClick={() => handleSelectSong(result)}
                        >
                          <img src={result.thumbnail} className="result-thumb" alt={result.title} />
                          <div className="result-info">
                            <div className="result-title">{cleanTitle(result.title)}</div>
                            <div className="result-channel">{result.channelTitle}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Selected Song Preview & Note Form */}
              {selectedSong && (
                <div>
                  <div className="selected-song-card">
                    <img src={selectedSong.thumbnail} className="selected-song-thumb" alt={selectedSong.title} />
                    <div className="selected-song-info">
                      <div className="selected-song-title">{cleanTitle(selectedSong.title)}</div>
                      <div className="selected-song-artist">{selectedSong.channelTitle}</div>
                    </div>
                    {!song && (
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => setSelectedSong(null)}
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {selectedSong.videoId && (
                    <div className="video-container">
                      <iframe
                        src={`https://www.youtube.com/embed/${selectedSong.videoId}`}
                        title={selectedSong.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="note">Add a Note (Optional)</label>
                    <textarea
                      id="note"
                      rows="3"
                      className="form-control"
                      placeholder="Why did you choose this song today? How does it make you feel?"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      style={{ resize: 'none' }}
                    ></textarea>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          
          {!isReadOnly && selectedSong && (
            <button 
              className="btn btn-primary" 
              onClick={handleSave} 
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Song'}
            </button>
          )}

          {!isReadOnly && song && (
            <button 
              className="btn btn-danger" 
              onClick={handleDelete}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
