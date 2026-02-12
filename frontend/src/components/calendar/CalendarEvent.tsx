import React from 'react';
import { CalendarEvent as CalendarEventType } from '../../../../shared/types';

interface CalendarEventProps {
  event: CalendarEventType;
  onEdit?: (event: CalendarEventType) => void;
  onDelete?: (eventId: string) => void;
}

const CalendarEvent: React.FC<CalendarEventProps> = ({ event, onEdit, onDelete }) => {
  return (
    <div className="kawaii-card p-4 mb-3 flex items-center justify-between">
      <div>
        <h4 className="font-semibold text-pink-600">{event.title}</h4>
        <p className="text-sm text-gray-600">
          {new Date(event.startTime).toLocaleString()} - {new Date(event.endTime).toLocaleTimeString()}
        </p>
        {event.location && (
          <p className="text-xs text-gray-500 mt-1">📍 {event.location}</p>
        )}
        {event.description && (
          <p className="text-sm text-gray-700 mt-1">{event.description}</p>
        )}
      </div>

      <div className="flex gap-2">
        {onEdit && (
          <button
            onClick={() => onEdit(event)}
            className="text-xs bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
          >
            Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(event.id)}
            className="text-xs bg-gradient-to-r from-red-500 to-rose-600 text-white px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
};

export default CalendarEvent;