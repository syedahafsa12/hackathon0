import fs from "fs";
import path from "path";
import config from "../config";

/**
 * HandbookService - Hackathon 0 Principle #2 (HITL Mandatory with Thresholds)
 * Parses Company_Handbook.md to determine auto-approval rules.
 */
export class HandbookService {
  private handbookPath: string;
  private autoApproveThresholdMs: number = 30 * 60 * 1000; // Default 30 min

  constructor() {
    this.handbookPath = path.join(config.vaultPath, "Company_Handbook.md");
    this.loadRules();
  }

  public loadRules() {
    try {
      if (!fs.existsSync(this.handbookPath)) {
        console.warn(
          `[HandbookService] Handbook not found at ${this.handbookPath}. Using defaults.`,
        );
        return;
      }

      const content = fs.readFileSync(this.handbookPath, "utf8");

      // Simple regex parser for thresholds
      const thresholdMatch = content.match(
        /Auto-approve tasks under (\d+) min/i,
      );
      if (thresholdMatch) {
        const mins = parseInt(thresholdMatch[1]);
        this.autoApproveThresholdMs = mins * 60 * 1000;
        console.log(
          `[HandbookService] Set auto-approve threshold to ${mins} minutes`,
        );
      }
    } catch (err) {
      console.error("[HandbookService] Error loading rules:", err);
    }
  }

  /**
   * Check if an action can be auto-approved based on handbook rules
   */
  public isAutoApprovable(action: {
    type: string;
    durationEstimate?: number;
  }): boolean {
    // 1. Mandatory approvals (financial, deletion) - always false
    if (
      action.type.includes("PAY") ||
      action.type.includes("DELETE") ||
      action.type.includes("PURCHASE")
    ) {
      return false;
    }

    // 2. Threshold-based approval
    if (
      action.durationEstimate &&
      action.durationEstimate <= this.autoApproveThresholdMs
    ) {
      return true;
    }

    // 3. Specific minor types
    if (["FETCH_NEWS", "GET_PRIORITIES", "LIST_FILES"].includes(action.type)) {
      return true;
    }

    return false;
  }
}

export const handbookService = new HandbookService();
export default handbookService;
