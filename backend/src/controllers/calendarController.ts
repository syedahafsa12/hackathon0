import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../middleware/auth';
import calendarService from '../services/calendarService';
import calendarAgent from '../services/agents/calendarAgent';

export class CalendarController {
  async createCalendarEvent(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { title, description, startDate, endDate, location, attendees } = req.body as {
        title: string;
        description?: string;
        startDate: string;
        endDate: string;
        location?: string;
        attendees?: Array<{ name: string; email: string }>;
      };

      const userId = req.userId;

      if (!title || !startDate || !endDate) {
        return res.status(400).send({
          success: false,
          error: { code: 'MISSING_REQUIRED_FIELDS', message: 'Title, start date, and end date are required' }
        });
      }

      const event = await calendarService.createCalendarEvent(userId, {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        attendees
      });

      return res.status(201).send({
        success: true,
        data: event
      });
    } catch (error) {
      console.error('Error creating calendar event:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create calendar event' }
      });
    }
  }

  async getCalendarEvents(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { startDate, endDate, limit } = req.query as {
        startDate?: string;
        endDate?: string;
        limit?: string;
      };

      const userId = req.userId;
      const limitNum = limit ? parseInt(limit) : 50;

      const events = await calendarService.getCalendarEventsByUserId(
        userId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        limitNum
      );

      return res.send({
        success: true,
        data: { events }
      });
    } catch (error) {
      console.error('Error getting calendar events:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get calendar events' }
      });
    }
  }

  async getCalendarEvent(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const userId = req.userId;

      const event = await calendarService.getCalendarEventById(id, userId);

      if (!event) {
        return res.status(404).send({
          success: false,
          error: { code: 'EVENT_NOT_FOUND', message: 'Calendar event not found' }
        });
      }

      return res.send({
        success: true,
        data: event
      });
    } catch (error) {
      console.error('Error getting calendar event:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get calendar event' }
      });
    }
  }

  async updateCalendarEvent(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const { title, description, startDate, endDate, location, attendees } = req.body as {
        title?: string;
        description?: string;
        startDate?: string;
        endDate?: string;
        location?: string;
        attendees?: Array<{ name: string; email: string }>;
      };

      const userId = req.userId;

      const updatedEvent = await calendarService.updateCalendarEvent(id, userId, {
        title,
        description,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        location,
        attendees
      });

      return res.send({
        success: true,
        data: updatedEvent
      });
    } catch (error) {
      console.error('Error updating calendar event:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update calendar event' }
      });
    }
  }

  async deleteCalendarEvent(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const userId = req.userId;

      const success = await calendarService.deleteCalendarEvent(id, userId);

      if (!success) {
        return res.status(404).send({
          success: false,
          error: { code: 'EVENT_NOT_FOUND', message: 'Calendar event not found' }
        });
      }

      return res.send({
        success: true,
        data: { message: 'Calendar event deleted successfully' }
      });
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete calendar event' }
      });
    }
  }

  async getTodaysEvents(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const userId = req.userId;

      const events = await calendarService.getTodaysEvents(userId);

      return res.send({
        success: true,
        data: { events }
      });
    } catch (error) {
      console.error('Error getting today\'s events:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get today\'s events' }
      });
    }
  }

  async processCalendarCommand(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { command } = req.body as { command: string };
      const userId = req.userId;

      if (!command) {
        return res.status(400).send({
          success: false,
          error: { code: 'MISSING_COMMAND', message: 'Calendar command is required' }
        });
      }

      const result = await calendarAgent.processCalendarCommand(userId, command);

      return res.send({
        success: result.success,
        message: result.message,
        data: result.event || result.events
      });
    } catch (error) {
      console.error('Error processing calendar command:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process calendar command' }
      });
    }
  }
}

export default new CalendarController();