import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../middleware/auth';
import emailService from '../services/emailService';
import emailAgent from '../services/agents/emailAgent';
import emailWatcher from '../services/watchers/emailWatcher';

export class EmailController {
  async getEmailMessages(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { importance, status, limit } = req.query as {
        importance?: string;
        status?: string;
        limit?: string;
      };

      const userId = req.userId;
      const limitNum = limit ? parseInt(limit) : 20;

      const emails = await emailService.getEmailMessagesByUserId(
        userId,
        importance,
        status,
        limitNum
      );

      return res.send({
        success: true,
        data: { emails }
      });
    } catch (error) {
      console.error('Error getting email messages:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get email messages' }
      });
    }
  }

  async getEmailMessage(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const userId = req.userId;

      const email = await emailService.getEmailMessageById(id, userId);

      if (!email) {
        return res.status(404).send({
          success: false,
          error: { code: 'EMAIL_NOT_FOUND', message: 'Email message not found' }
        });
      }

      return res.send({
        success: true,
        data: email
      });
    } catch (error) {
      console.error('Error getting email message:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get email message' }
      });
    }
  }

  async processEmail(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { emailId } = req.body as { emailId: string };
      const userId = req.userId;

      const result = await emailAgent.processEmail(userId, emailId);

      return res.send({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error processing email:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process email' }
      });
    }
  }

  async generateDraftReply(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { emailId } = req.body as { emailId: string };
      const userId = req.userId;

      const result = await emailAgent.generateDraftReply(userId, emailId);

      return res.send({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error generating draft reply:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to generate draft reply' }
      });
    }
  }

  async connectEmailService(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { provider, credentials } = req.body as {
        provider: 'gmail' | 'outlook' | 'imap';
        credentials: any;
      };
      const userId = req.userId;

      // In a real implementation, this would securely store credentials
      await emailWatcher.connectToEmailService(userId, provider, credentials);

      return res.send({
        success: true,
        data: { message: 'Email service connected successfully' }
      });
    } catch (error) {
      console.error('Error connecting email service:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to connect email service' }
      });
    }
  }

  async updateEmailStatus(req: AuthenticatedRequest, res: FastifyReply) {
    try {
      const { emailId } = req.params as { emailId: string };
      const { status } = req.body as { status: 'unread' | 'read' | 'processed' | 'action-required' | 'approved' | 'rejected' };
      const userId = req.userId;

      const validStatuses: Array<'unread' | 'read' | 'processed' | 'action-required' | 'approved' | 'rejected'> = [
        'unread', 'read', 'processed', 'action-required', 'approved', 'rejected'
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).send({
          success: false,
          error: { code: 'INVALID_STATUS', message: 'Invalid status value' }
        });
      }

      const updatedEmail = await emailService.updateEmailMessageStatus(emailId, userId, status);

      return res.send({
        success: true,
        data: updatedEmail
      });
    } catch (error) {
      console.error('Error updating email status:', error);
      return res.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update email status' }
      });
    }
  }
}

export default new EmailController();