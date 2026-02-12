import { IntentRouter } from '../../src/services/intentRouter/intentRouter';
import { IntentType } from '../../src/services/intentRouter/intentTypes';

// Mock the approval service
jest.mock('../../src/services/approval/approvalService', () => ({
  default: {
    createApproval: jest.fn().mockResolvedValue({
      id: 'test-approval-id',
      userId: 'test-user',
      actionType: 'email_send',
      status: 'pending'
    })
  }
}));

describe('IntentRouter', () => {
  let router: IntentRouter;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    router = new IntentRouter({ confidenceThreshold: 0.7 });
  });

  describe('User Story 1: Email Commands', () => {
    it('should classify "send email to syedahafsa832@gmail.com saying hi" as SEND_EMAIL', async () => {
      const response = await router.processMessage(
        testUserId,
        'send email to syedahafsa832@gmail.com saying hi'
      );

      expect(response.classification.intent).toBe(IntentType.SEND_EMAIL);
      expect(response.classification.confidence).toBeGreaterThanOrEqual(0.7);
      expect(response.classification.entities.recipient).toBe('syedahafsa832@gmail.com');
      expect(response.eventCreated).toBe(true);
      expect(response.message).toContain('email');
    });

    it('should classify "bro email this guy john@test.com" with casual language', async () => {
      const response = await router.processMessage(
        testUserId,
        'bro email this guy john@test.com about the project'
      );

      expect(response.classification.intent).toBe(IntentType.SEND_EMAIL);
      expect(response.classification.confidence).toBeGreaterThanOrEqual(0.7);
      expect(response.classification.entities.recipient).toBe('john@test.com');
      expect(response.eventCreated).toBe(true);
    });

    it('should create approval event for email intent', async () => {
      const response = await router.processMessage(
        testUserId,
        'send email to test@example.com saying hello'
      );

      expect(response.eventCreated).toBe(true);
      expect(response.eventId).toBeDefined();
      expect(response.message).toContain('draft');
    });
  });

  describe('User Story 2: Conversational Responses', () => {
    it('should classify "hi" as GREETING and not create event', async () => {
      const response = await router.processMessage(testUserId, 'hi');

      expect(response.classification.intent).toBe(IntentType.GREETING);
      expect(response.classification.confidence).toBeGreaterThanOrEqual(0.9);
      expect(response.eventCreated).toBe(false);
      expect(response.message).toBeTruthy();
      expect(response.message.toLowerCase()).not.toContain('received your message');
    });

    it('should classify "thanks!" as CHAT and respond warmly', async () => {
      const response = await router.processMessage(testUserId, 'thanks!');

      expect(response.classification.intent).toBe(IntentType.CHAT);
      expect(response.eventCreated).toBe(false);
      expect(response.message).toBeTruthy();
    });

    it('should not echo user input', async () => {
      const userInput = 'hello there';
      const response = await router.processMessage(testUserId, userInput);

      expect(response.message).not.toContain('I received your message');
      expect(response.message).not.toContain(`"${userInput}"`);
    });
  });

  describe('User Story 3: Task Creation', () => {
    it('should classify "add a task to buy groceries" as CREATE_TASK', async () => {
      const response = await router.processMessage(
        testUserId,
        'add a task to buy groceries'
      );

      expect(response.classification.intent).toBe(IntentType.CREATE_TASK);
      expect(response.classification.confidence).toBeGreaterThanOrEqual(0.7);
      expect(response.eventCreated).toBe(true);
    });

    it('should classify "remind me to call mom" as CREATE_REMINDER', async () => {
      const response = await router.processMessage(
        testUserId,
        'remind me to call mom tomorrow'
      );

      expect([IntentType.CREATE_REMINDER, IntentType.CREATE_TASK]).toContain(
        response.classification.intent
      );
      expect(response.eventCreated).toBe(true);
    });
  });

  describe('User Story 4: Calendar', () => {
    it('should classify "what\'s on my calendar today" as CHECK_CALENDAR', async () => {
      const response = await router.processMessage(
        testUserId,
        "what's on my calendar today"
      );

      expect(response.classification.intent).toBe(IntentType.CHECK_CALENDAR);
      expect(response.classification.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should classify "schedule a meeting tomorrow at 2pm" as CREATE_CALENDAR_EVENT', async () => {
      const response = await router.processMessage(
        testUserId,
        'schedule a meeting with John tomorrow at 2pm'
      );

      expect(response.classification.intent).toBe(IntentType.CREATE_CALENDAR_EVENT);
      expect(response.eventCreated).toBe(true);
    });
  });

  describe('Confidence Threshold', () => {
    it('should request clarification for low confidence intents', async () => {
      // Create router with high threshold for testing
      const strictRouter = new IntentRouter({ confidenceThreshold: 0.99 });

      const response = await strictRouter.processMessage(testUserId, 'hmm');

      expect(response.needsClarification).toBe(true);
      expect(response.eventCreated).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return friendly error for processing failures', async () => {
      // The fallback mode should still work
      const response = await router.processMessage(testUserId, 'test message');

      expect(response.message).toBeTruthy();
      expect(response.classification).toBeDefined();
    });
  });
});
