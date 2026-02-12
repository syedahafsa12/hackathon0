import { ApprovalService } from "../src/services/approval/approvalService";

const approvalService = new ApprovalService();

async function testAutoApproval() {
  console.log("Testing auto-approval for a 5-minute task...");
  try {
    const approval = await approvalService.createApproval("dev-user-001", {
      actionType: "CREATE_TASK",
      actionData: { title: "Test Small Task", durationEstimate: 5 },
    });

    console.log("Resulting Approval Status:", approval.status);

    if (approval.status === "approved") {
      console.log("✅ SUCCESS: Small task auto-approved!");
    } else {
      console.log("❌ FAILURE: Task should have been auto-approved.");
    }
  } catch (err) {
    console.error("Test failed with error:", err);
  }
}

testAutoApproval().catch(console.error);
