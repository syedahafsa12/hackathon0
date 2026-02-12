import { PrismaClient } from '@prisma/client';
import calendarService from '../calendarService';
import { parseISO, isValid, format } from 'date-fns';

const prisma = new PrismaClient();

export class CalendarAgent {
  async processCalendarCommand(userId: string, command: string) {
    try {
      // Parse the command to determine intent
      const intent = this.identifyIntent(command);

      switch (intent) {
        case 'create_event':
          return await this.handleCreateEvent(userId, command);
        case 'list_events':
          return await this.handleListEvents(userId);
        case 'get_todays_events':
          return await this.handleGetTodaysEvents(userId);
        case 'get_upcoming_events':
          return await this.handleGetUpcomingEvents(userId);
        case 'delete_event':
          return await this.handleDeleteEvent(userId, command);
        default:
          return {
            success: false,
            message: 'Unable to understand the calendar command. Try phrases like "schedule a meeting with John tomorrow at 2pm" or "what\'s on my calendar today"'
          };
      }
    } catch (error) {
      console.error('Error processing calendar command:', error);
      throw error;
    }
  }

  private identifyIntent(command: string): string {
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes('schedule') || lowerCommand.includes('create') || lowerCommand.includes('add') ||
        lowerCommand.includes('event') || lowerCommand.includes('meeting') || lowerCommand.includes('appointment')) {
      return 'create_event';
    } else if (lowerCommand.includes('show') || lowerCommand.includes('list') || lowerCommand.includes('my calendar') ||
               lowerCommand.includes('what') && lowerCommand.includes('calendar')) {
      return 'list_events';
    } else if (lowerCommand.includes('today') || lowerCommand.includes('today\'s') || lowerCommand.includes('today’s')) {
      return 'get_todays_events';
    } else if (lowerCommand.includes('upcoming') || lowerCommand.includes('next') || lowerCommand.includes('week') ||
               lowerCommand.includes('tomorrow')) {
      return 'get_upcoming_events';
    } else if (lowerCommand.includes('delete') || lowerCommand.includes('remove') || lowerCommand.includes('cancel')) {
      return 'delete_event';
    } else {
      // Default to list events for commands that might be asking about calendar
      return 'list_events';
    }
  }

  private async handleCreateEvent(userId: string, command: string) {
    // Extract event details from the command
    const eventDetails = await this.extractEventDetails(command);

    if (!eventDetails.title) {
      return {
        success: false,
        message: 'Could not identify the event title. Please specify what event you want to schedule.'
      };
    }

    if (!eventDetails.startDate || !isValid(eventDetails.startDate)) {
      return {
        success: false,
        message: 'Could not identify a valid date/time for the event. Please specify when the event should occur.'
      };
    }

    if (!eventDetails.endDate) {
      // If no end time specified, default to 1 hour duration
      eventDetails.endDate = new Date(eventDetails.startDate.getTime() + 60 * 60 * 1000);
    }

    // Create the calendar event
    const event = await calendarService.createCalendarEvent(userId, {
      title: eventDetails.title,
      description: eventDetails.description,
      startDate: eventDetails.startDate,
      endDate: eventDetails.endDate,
      location: eventDetails.location,
      attendees: eventDetails.attendees
    });

    return {
      success: true,
      message: `Event "${event.title}" has been scheduled for ${format(event.startDate, 'PPpp')} and will end at ${format(event.endDate, 'pp')}.`,
      event: event
    };
  }

  private async handleListEvents(userId: string) {
    const events = await calendarService.getCalendarEventsByUserId(userId);

    if (events.length === 0) {
      return {
        success: true,
        message: 'You have no events scheduled. You can create one by saying something like "schedule a meeting with John tomorrow at 2pm"',
        events: []
      };
    }

    return {
      success: true,
      message: `You have ${events.length} event${events.length !== 1 ? 's' : ''} scheduled.`,
      events: events
    };
  }

  private async handleGetTodaysEvents(userId: string) {
    const events = await calendarService.getTodaysEvents(userId);

    if (events.length === 0) {
      return {
        success: true,
        message: 'You have no events scheduled for today.',
        events: []
      };
    }

    return {
      success: true,
      message: `You have ${events.length} event${events.length !== 1 ? 's' : ''} scheduled for today:`,
      events: events
    };
  }

  private async handleGetUpcomingEvents(userId: string) {
    const events = await calendarService.getNextWeekEvents(userId);

    if (events.length === 0) {
      return {
        success: true,
        message: 'You have no events scheduled for the next week.',
        events: []
      };
    }

    return {
      success: true,
      message: `You have ${events.length} event${events.length !== 1 ? 's' : ''} scheduled for the next week:`,
      events: events
    };
  }

  private async handleDeleteEvent(userId: string, command: string) {
    // Extract event details from the command to identify which event to delete
    // This is a simplified implementation - in reality, you'd need more sophisticated NLP

    // Get all events to try to match the command
    const events = await calendarService.getCalendarEventsByUserId(userId);

    // Try to find an event that matches words in the command
    const lowerCommand = command.toLowerCase();
    let eventToDelete = null;

    for (const event of events) {
      if (lowerCommand.includes(event.title.toLowerCase()) ||
          (event.description && lowerCommand.includes(event.description.toLowerCase()))) {
        eventToDelete = event;
        break;
      }
    }

    if (eventToDelete) {
      await calendarService.deleteCalendarEvent(eventToDelete.id, userId);
      return {
        success: true,
        message: `Event "${eventToDelete.title}" has been deleted.`
      };
    } else {
      return {
        success: false,
        message: 'No matching event found to delete. Please specify which event you want to delete.'
      };
    }
  }

  private async extractEventDetails(command: string) {
    // This is a simplified implementation of natural language processing
    // In a real application, you'd want to use a more sophisticated NLP library

    const result: any = {
      title: '',
      description: '',
      startDate: null,
      endDate: null,
      location: '',
      attendees: []
    };

    // Extract title (everything that's not a date/time/location/attendee)
    // For simplicity, we'll take the first part of the sentence before any time indicators
    const timeIndicators = [' at ', ' on ', ' from ', ' to ', ' tomorrow', ' today', ' next '];
    let titleEndIndex = command.length;

    for (const indicator of timeIndicators) {
      const index = command.toLowerCase().indexOf(indicator);
      if (index !== -1 && index < titleEndIndex) {
        titleEndIndex = index;
      }
    }

    result.title = command.substring(0, titleEndIndex).trim();

    // If title is empty, try to extract it differently
    if (!result.title) {
      // Look for common phrases like "schedule a meeting with" or "add event"
      const scheduleRegex = /(schedule|create|add|set up)\s+(an?\s+)?(meeting|appointment|event|call)\s+(with\s+)?(.+?)(\s+(at|on|from|to|tomorrow|today|next))/i;
      const match = command.match(scheduleRegex);
      if (match) {
        result.title = match[5].trim();
      } else {
        result.title = command;
      }
    }

    // Extract date/time information (simplified)
    // This is a very basic implementation - in reality, you'd use a library like chrono-node
    const now = new Date();

    if (command.toLowerCase().includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Try to extract time
      const timeMatch = command.match(/(\d{1,2})(:(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        const minute = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
        const ampm = timeMatch[4] ? timeMatch[4].toLowerCase() : 'am';

        let hour24 = hour;
        if (ampm === 'pm' && hour !== 12) {
          hour24 += 12;
        } else if (ampm === 'am' && hour === 12) {
          hour24 = 0;
        }

        tomorrow.setHours(hour24, minute, 0, 0);
        result.startDate = tomorrow;
      } else {
        // Default to 9am if no specific time
        tomorrow.setHours(9, 0, 0, 0);
        result.startDate = tomorrow;
      }
    } else if (command.toLowerCase().includes('today')) {
      // Try to extract time
      const timeMatch = command.match(/(\d{1,2})(:(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        const minute = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
        const ampm = timeMatch[4] ? timeMatch[4].toLowerCase() : 'am';

        let hour24 = hour;
        if (ampm === 'pm' && hour !== 12) {
          hour24 += 12;
        } else if (ampm === 'am' && hour === 12) {
          hour24 = 0;
        }

        now.setHours(hour24, minute, 0, 0);
        result.startDate = now;
      } else {
        // Default to 2pm if no specific time
        now.setHours(14, 0, 0, 0);
        result.startDate = now;
      }
    } else {
      // Try to find a date in the command
      const dateMatch = command.match(/(\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?)/);
      if (dateMatch) {
        const dateStr = dateMatch[1];
        const parsedDate = new Date(dateStr);
        if (isValid(parsedDate)) {
          // Try to extract time
          const timeMatch = command.match(/(\d{1,2})(:(\d{2}))?\s*(am|pm)?/i);
          if (timeMatch) {
            const hour = parseInt(timeMatch[1]);
            const minute = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
            const ampm = timeMatch[4] ? timeMatch[4].toLowerCase() : 'am';

            let hour24 = hour;
            if (ampm === 'pm' && hour !== 12) {
              hour24 += 12;
            } else if (ampm === 'am' && hour === 12) {
              hour24 = 0;
            }

            parsedDate.setHours(hour24, minute, 0, 0);
          } else {
            // Default to 2pm if no specific time
            parsedDate.setHours(14, 0, 0, 0);
          }

          result.startDate = parsedDate;
        }
      }
    }

    return result;
  }
}

export default new CalendarAgent();