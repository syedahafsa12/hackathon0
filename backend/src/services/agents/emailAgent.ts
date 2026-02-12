import { PrismaClient } from "@prisma/client";
import emailService from "../emailService";
import openaiService from "../openaiService";
import approvalAgent from "./approvalAgent";

const prisma = new PrismaClient();

export class EmailAgent {
  async processEmail(userId: string, emailId: string) {
    try {
      // Get the email from the database
      const email = await emailService.getEmailMessageById(emailId, userId);
      if (!email) {
        throw new Error("Email not found or unauthorized");
      }

      // Update status to 'processed'
      await emailService.updateEmailMessageStatus(emailId, userId, "processed");

      // If the email is important, generate a draft reply
      if (["critical", "high", "action-required"].includes(email.importance)) {
        const draftReply = await openaiService.generateDraftEmail(
          email.subject,
          email.sender,
          email.body,
        );

        // Create an approval request for sending the email
        await approvalAgent.processApprovalRequest(userId, "email_send", {
          emailId: email.id,
          to: email.sender, // Assuming reply to sender
          subject: `Re: ${email.subject}`,
          body: draftReply,
        });

        // Update the email with the draft reply
        const updatedEmail = await prisma.emailMessage.update({
          where: { id: emailId },
          data: { draftReply, status: "action-required" },
        });

        return {
          email: updatedEmail,
          draftReply,
          requiresAction: true,
          approvalRequested: true,
        };
      } else {
        // For non-important emails, just mark as read
        await emailService.updateEmailMessageStatus(emailId, userId, "read");
        return {
          email,
          requiresAction: false,
        };
      }
    } catch (error) {
      console.error("Error processing email:", error);
      throw error;
    }
  }

  async generateDraftReply(userId: string, emailId: string) {
    try {
      const email = await emailService.getEmailMessageById(emailId, userId);
      if (!email) {
        throw new Error("Email not found or unauthorized");
      }

      // Generate a draft reply using OpenAI
      const draftReply = await openaiService.generateDraftEmail(
        email.subject,
        email.sender,
        email.body,
      );

      // Update the email with the draft reply
      const updatedEmail = await prisma.emailMessage.update({
        where: { id: emailId },
        data: { draftReply },
      });

      return {
        emailId: updatedEmail.id,
        draftReply: updatedEmail.draftReply,
      };
    } catch (error) {
      console.error("Error generating draft reply:", error);
      throw error;
    }
  }

  async sendEmailWithApproval(
    userId: string,
    emailData: {
      to: string;
      subject: string;
      body: string;
    },
  ) {
    try {
      // Create an approval request for sending the email
      const approval = await approvalAgent.processApprovalRequest(
        userId,
        "email_send",
        {
          to: emailData.to,
          subject: emailData.subject,
          body: emailData.body,
        },
      );

      return {
        success: true,
        message: "Email sending requires your approval",
        approval: approval.approval,
      };
    } catch (error) {
      console.error("Error requesting email approval:", error);
      throw error;
    }
  }

  async classifyEmail(
    userId: string,
    subject: string,
    body: string,
    sender: string,
  ) {
    // This would typically be handled by the emailService during creation
    // But we'll include it here as well for external classification
    const lowerSubject = subject.toLowerCase();
    const lowerBody = body.toLowerCase();
    const lowerSender = sender.toLowerCase();

    // Check for critical keywords
    if (
      lowerSubject.includes("security") ||
      lowerSubject.includes("urgent") ||
      lowerSubject.includes("critical")
    ) {
      return "critical";
    }

    // Check for high importance keywords
    if (
      lowerSubject.includes("meeting") ||
      lowerSubject.includes("deadline") ||
      lowerSubject.includes("important")
    ) {
      return "high";
    }

    // Check if sender is in contacts (assuming real humans are important)
    if (
      lowerSender.includes("@") &&
      !lowerSender.includes("noreply") &&
      !lowerSender.includes("no-reply")
    ) {
      return "high";
    }

    // Check for action-required keywords
    if (
      lowerSubject.includes("action") ||
      lowerSubject.includes("required") ||
      lowerSubject.includes("response")
    ) {
      return "high";
    }

    // Check for promotional/spam keywords
    if (
      lowerSubject.includes("offer") ||
      lowerSubject.includes("promotion") ||
      lowerSubject.includes("discount") ||
      lowerSubject.includes("sale") ||
      lowerSubject.includes("click here")
    ) {
      return "spam";
    }

    // Default to medium for most other cases
    return "medium";
  }

  async sendEmail(
    userId: string,
    emailData: {
      to: string;
      subject: string;
      body: string;
    },
  ) {
    try {
      // Import nodemailer dynamically
      const nodemailer = require("nodemailer");

      // Create SMTP transporter
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // Verify SMTP connection
      await transporter.verify();

      // Send email
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.body,
        html: `<p>${emailData.body.replace(/\n/g, "<br>")}</p>`,
      });

      console.log(`✓ Email sent successfully to ${emailData.to}`);
      console.log(`  Message ID: ${info.messageId}`);
      console.log(`  Accepted: ${info.accepted.join(", ")}`);

      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error(`✗ Email send failed:`, error);

      // Re-throw with more context
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Email send failed: ${errorMessage}`);
    }
  }
}

export default new EmailAgent();
