import { PrismaClient, EmailMessage as PrismaEmailMessage } from '@prisma/client';
import { EmailMessage } from '../../../shared/types';
import crypto from 'crypto';

const uuidv4 = (): string => crypto.randomUUID();
import openaiService from './openaiService';

const prisma = new PrismaClient();

export class EmailService {
  async createEmailMessage(userId: string, emailData: {
    messageId: string;
    subject: string;
    body: string;
    sender: string;
    recipient: string;
    importance?: 'critical' | 'high' | 'medium' | 'low' | 'spam';
    status?: 'unread' | 'read' | 'processed' | 'action-required' | 'approved' | 'rejected';
    draftReply?: string;
  }): Promise<EmailMessage> {
    try {
      const importance = emailData.importance || await this.classifyImportance(emailData.subject, emailData.body, emailData.sender);
      const status = emailData.status || 'unread';

      let draftReply = emailData.draftReply;
      if (!draftReply && this.shouldGenerateDraftReply(importance)) {
        draftReply = await openaiService.generateDraftEmail(emailData.subject, emailData.sender, emailData.body);
      }

      const emailMessage = await prisma.emailMessage.create({
        data: {
          id: uuidv4(),
          userId,
          messageId: emailData.messageId,
          subject: emailData.subject,
          body: emailData.body,
          sender: emailData.sender,
          recipient: emailData.recipient,
          receivedAt: new Date(),
          importance,
          status,
          draftReply
        }
      });

      return this.mapPrismaToEmailMessage(emailMessage);
    } catch (error) {
      console.error('Error creating email message:', error);
      throw error;
    }
  }

  async getEmailMessagesByUserId(userId: string, importance?: string, status?: string, limit: number = 20): Promise<EmailMessage[]> {
    try {
      const whereClause: any = { userId };

      if (importance) {
        whereClause.importance = importance;
      }

      if (status) {
        whereClause.status = status;
      }

      const emailMessages = await prisma.emailMessage.findMany({
        where: whereClause,
        orderBy: { receivedAt: 'desc' },
        take: limit
      });

      return emailMessages.map(this.mapPrismaToEmailMessage);
    } catch (error) {
      console.error('Error getting email messages:', error);
      throw error;
    }
  }

  async getEmailMessageById(id: string, userId: string): Promise<EmailMessage | null> {
    try {
      const emailMessage = await prisma.emailMessage.findUnique({
        where: { id }
      });

      if (!emailMessage || emailMessage.userId !== userId) {
        return null;
      }

      return this.mapPrismaToEmailMessage(emailMessage);
    } catch (error) {
      console.error('Error getting email message by id:', error);
      throw error;
    }
  }

  async updateEmailMessageStatus(id: string, userId: string, status: 'unread' | 'read' | 'processed' | 'action-required' | 'approved' | 'rejected'): Promise<EmailMessage> {
    try {
      const emailMessage = await prisma.emailMessage.findUnique({
        where: { id }
      });

      if (!emailMessage || emailMessage.userId !== userId) {
        throw new Error('Email message not found or unauthorized');
      }

      const updatedEmailMessage = await prisma.emailMessage.update({
        where: { id },
        data: { status }
      });

      return this.mapPrismaToEmailMessage(updatedEmailMessage);
    } catch (error) {
      console.error('Error updating email message status:', error);
      throw error;
    }
  }

  async generateDraftReply(id: string, userId: string): Promise<EmailMessage> {
    try {
      const emailMessage = await prisma.emailMessage.findUnique({
        where: { id }
      });

      if (!emailMessage || emailMessage.userId !== userId) {
        throw new Error('Email message not found or unauthorized');
      }

      const draftReply = await openaiService.generateDraftEmail(
        emailMessage.subject,
        emailMessage.sender,
        emailMessage.body
      );

      const updatedEmailMessage = await prisma.emailMessage.update({
        where: { id },
        data: { draftReply }
      });

      return this.mapPrismaToEmailMessage(updatedEmailMessage);
    } catch (error) {
      console.error('Error generating draft reply:', error);
      throw error;
    }
  }

  private async classifyImportance(subject: string, body: string, sender: string): Promise<'critical' | 'high' | 'medium' | 'low' | 'spam'> {
    // Basic classification logic - in a real implementation, this could use ML or more sophisticated rules
    const lowerSubject = subject.toLowerCase();
    const lowerBody = body.toLowerCase();
    const lowerSender = sender.toLowerCase();

    // Check for critical keywords
    if (lowerSubject.includes('security') || lowerSubject.includes('urgent') || lowerSubject.includes('critical')) {
      return 'critical';
    }

    // Check for high importance keywords
    if (lowerSubject.includes('meeting') || lowerSubject.includes('deadline') || lowerSubject.includes('important')) {
      return 'high';
    }

    // Check if sender is in contacts (assuming real humans are important)
    if (lowerSender.includes('@') && !lowerSender.includes('noreply') && !lowerSender.includes('no-reply')) {
      return 'high';
    }

    // Check for action-required keywords
    if (lowerSubject.includes('action') || lowerSubject.includes('required') || lowerSubject.includes('response')) {
      return 'high';
    }

    // Check for promotional/spam keywords
    if (lowerSubject.includes('offer') || lowerSubject.includes('promotion') || lowerSubject.includes('discount') ||
        lowerSubject.includes('sale') || lowerSubject.includes('click here')) {
      return 'spam';
    }

    // Default to medium for most other cases
    return 'medium';
  }

  private shouldGenerateDraftReply(importance: string): boolean {
    return importance === 'critical' || importance === 'high' || importance === 'action-required';
  }

  private mapPrismaToEmailMessage(prismaEmail: PrismaEmailMessage): EmailMessage {
    return {
      id: prismaEmail.id,
      userId: prismaEmail.userId,
      messageId: prismaEmail.messageId,
      subject: prismaEmail.subject,
      body: prismaEmail.body,
      sender: prismaEmail.sender,
      recipient: prismaEmail.recipient,
      receivedAt: prismaEmail.receivedAt,
      importance: prismaEmail.importance as 'critical' | 'high' | 'medium' | 'low' | 'spam',
      status: prismaEmail.status as 'unread' | 'read' | 'processed' | 'action-required' | 'approved' | 'rejected',
      draftReply: prismaEmail.draftReply || undefined
    };
  }
}

export default new EmailService();