import React, { useState } from 'react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function Calendar({ songs, onDateClick, isReadOnly, viewOwnerName }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Get total days in the current month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Get weekday index of the first day of the month (e.g. 0 = Sunday, 1 = Monday)
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Format date helper: YYYY-MM-DD
  const formatDateKey = (day) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Check if a day is today
  const isToday = (day) => {
    const today = new Date();
    return today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year;
  };

  // Compile calendar cells
  const cells = [];
  
  // Empty slots before the first day of the month
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
  }

  // Active days
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = formatDateKey(day);
    const daySong = songs.find(s => s.date === dateStr);
    const dayIsToday = isToday(day);

    cells.push(
      <div 
        key={`day-${day}`} 
        className={`calendar-day ${dayIsToday ? 'today' : ''}`}
        onClick={() => onDateClick(dateStr, daySong)}
      >
        <span className="day-number">{day}</span>
        
        {daySong ? (
          <>
            <img 
              src={daySong.thumbnail} 
              alt={daySong.title} 
              className="day-song-thumb"
            />
            <div className="day-song-content">
              <div className="day-song-title" title={daySong.title}>
                {daySong.title.replace(/(&quot;|"|&amp;|&)/g, '"')}
              </div>
              <div className="day-song-artist" title={daySong.channelTitle}>
                {daySong.channelTitle}
              </div>
            </div>
          </>
        ) : (
          !isReadOnly && (
            <div className="add-song-icon">
              <span>+</span>
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <div className="calendar-view-header">
        <div>
          <h2 className="calendar-month-title">
            {MONTHS[month]} {year}
          </h2>
          {isReadOnly && viewOwnerName && (
            <p style={{ color: '#e59885', fontSize: '0.9rem', fontWeight: 700, marginTop: '0.2rem' }}>
              Viewing {viewOwnerName}'s Music Calendar
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={handlePrevMonth} style={{ padding: '0.4rem 0.8rem' }}>
            &lt;
          </button>
          <button className="btn btn-secondary" onClick={handleToday} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            Today
          </button>
          <button className="btn btn-secondary" onClick={handleNextMonth} style={{ padding: '0.4rem 0.8rem' }}>
            &gt;
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map(day => (
          <div key={day} className="calendar-weekday">
            {day}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}
