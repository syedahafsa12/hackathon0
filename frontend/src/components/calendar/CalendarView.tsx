import React, { useState, useEffect, useCallback } from 'react';
import CalendarEvent from './CalendarEvent';
import { CalendarEvent as CalendarEventType } from '../../../../shared/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface CalendarViewProps {
  events?: CalendarEventType[];
  onEventEdit?: (event: CalendarEventType) => void;
  onEventDelete?: (eventId: string) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  events: propEvents,
  onEventEdit,
  onEventDelete,
  autoRefresh = true,
  refreshInterval = 60000
}) => {
  const [events, setEvents] = useState<CalendarEventType[]>(propEvents || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  const checkGoogleAuth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google/status`);
      const result = await response.json();
      if (result.success && result.data?.connected) {
        setIsGoogleConnected(true);
      }
    } catch (err) {
      console.error('[CalendarView] Error checking auth:', err);
    }
  };

  useEffect(() => {
    checkGoogleAuth();
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[CalendarView] Fetching events...');

      const response = await fetch(`${API_BASE_URL}/api/calendar/events`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[CalendarView] Received:', result);

      if (result.success && result.data?.events) {
        setEvents(result.data.events);
        setError(null);
      }
    } catch (err) {
      console.error('[CalendarView] Error:', err);
      // Don't show error if it's just empty (e.g. no auth)
      // setError('Failed to load events'); 
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!propEvents) {
      fetchEvents();
    }

    if (autoRefresh && !propEvents) {
      const interval = setInterval(fetchEvents, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchEvents, propEvents, autoRefresh, refreshInterval]);

  useEffect(() => {
    if (propEvents) {
      setEvents(propEvents);
    }
  }, [propEvents]);

  const handleEventClick = (event: CalendarEventType) => {
    setSelectedEvent(event);
    if (onEventEdit) {
      onEventEdit(event);
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      console.log('[CalendarView] Deleting event:', eventId);

      const response = await fetch(`${API_BASE_URL}/api/calendar/events/${eventId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      setEvents(prev => prev.filter(e => e.id !== eventId));
      setSelectedEvent(null);

      if (onEventDelete) {
        onEventDelete(eventId);
      }
    } catch (err) {
      console.error('[CalendarView] Error deleting:', err);
      setError('Failed to delete event');
    }
  };

  // Group events by date
  const eventsByDate: { [date: string]: CalendarEventType[] } = {};
  events.forEach(event => {
    const dateStr = new Date(event.startTime).toDateString();
    if (!eventsByDate[dateStr]) {
      eventsByDate[dateStr] = [];
    }
    eventsByDate[dateStr].push(event);
  });

  // Sort dates
  const sortedDates = Object.keys(eventsByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // Filter to show only today and future events
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureDates = sortedDates.filter(date => new Date(date) >= today);

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const isToday = (dateStr: string) => {
    return new Date(dateStr).toDateString() === new Date().toDateString();
  };

  return (
    <div className="kawaii-card p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-pink-600">Calendar</h3>
        <div className="flex items-center gap-2">
          {!isGoogleConnected && (
            <a
              href={`${API_BASE_URL}/auth/google`}
              className="text-xs bg-blue-100 text-blue-600 px-3 py-1.5 rounded-full hover:bg-blue-200 transition-colors font-medium flex items-center gap-1"
            >
              <span>🔗</span> Connect Google
            </a>
          )}
          <button
            onClick={fetchEvents}
            className="text-sm text-pink-600 hover:text-pink-800 transition-colors"
            disabled={loading}
          >
            {loading ? '...' : '↻'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading && events.length === 0 ? (
        <div className="text-center py-6">
          <div className="flex justify-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-purple-300 animate-bounce"></div>
            <div className="w-2 h-2 rounded-full bg-purple-300 animate-bounce delay-75"></div>
            <div className="w-2 h-2 rounded-full bg-purple-300 animate-bounce delay-150"></div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {futureDates.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <div className="text-3xl mb-2">📅</div>
              <p>No upcoming events</p>
              <p className="text-xs mt-1">Say "schedule a meeting..." to add one</p>
            </div>
          ) : (
            futureDates.map(date => (
              <div key={date}>
                <h4 className={`text-sm font-semibold mb-2 ${isToday(date) ? 'text-pink-600' : 'text-purple-600'}`}>
                  {isToday(date) ? 'Today' : new Date(date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </h4>
                <div className="space-y-2">
                  {eventsByDate[date]
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                    .map(event => (
                      <div
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className="p-3 bg-white rounded-xl border border-purple-100 cursor-pointer hover:bg-purple-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-xs text-purple-600 font-medium whitespace-nowrap">
                            {formatTime(new Date(event.startTime))}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-gray-800 text-sm truncate">{event.title}</h5>
                            {event.location && (
                              <p className="text-xs text-gray-500 mt-0.5">📍 {event.location}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-purple-600">{selectedEvent.title}</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>📅</span>
                <span>
                  {new Date(selectedEvent.startTime).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>🕐</span>
                <span>
                  {formatTime(new Date(selectedEvent.startTime))} - {formatTime(new Date(selectedEvent.endTime))}
                </span>
              </div>

              {selectedEvent.location && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>📍</span>
                  <span>{selectedEvent.location}</span>
                </div>
              )}

              {selectedEvent.description && (
                <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-700">{selectedEvent.description}</p>
                </div>
              )}

              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Attendees</h5>
                  <div className="flex flex-wrap gap-1">
                    {selectedEvent.attendees.map((attendee, idx) => (
                      <span key={idx} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                        {attendee.name || attendee.email}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="flex-1 kawaii-button bg-gray-100 text-gray-700 text-sm py-2 hover:bg-gray-200"
              >
                Close
              </button>
              <button
                onClick={() => handleDelete(selectedEvent.id)}
                className="kawaii-button bg-red-100 text-red-700 text-sm py-2 px-4 hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;