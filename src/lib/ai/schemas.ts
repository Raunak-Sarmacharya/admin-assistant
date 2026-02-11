import { z } from "zod";

export const MeetingOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      "A 2-3 paragraph professional summary of the meeting, written in past tense. Include key financial figures discussed."
    ),
  key_topics: z
    .array(z.string())
    .describe(
      "3-6 concise topic labels summarizing what was discussed (e.g. 'Roth Conversion Strategy', 'Estate Planning')"
    ),
  tasks: z
    .array(
      z.object({
        description: z
          .string()
          .describe("Clear, actionable task description"),
        priority: z.enum(["high", "medium", "low"]),
        due_date_suggestion: z
          .string()
          .nullable()
          .describe(
            "Suggested due date in ISO format (YYYY-MM-DD) based on context clues, or null if unclear"
          ),
      })
    )
    .describe("Action items extracted from the meeting transcript"),
  email_draft: z
    .string()
    .describe(
      "A professional, warm follow-up email to the client summarizing the meeting and next steps. Use markdown formatting for structure. Do NOT include specific account numbers or SSNs."
    ),
});

export type MeetingOutputType = z.infer<typeof MeetingOutputSchema>;

export const ComplianceFlagSchema = z.object({
  flags: z.array(
    z.object({
      flagged_text: z
        .string()
        .describe(
          "The exact substring from the email draft that is problematic"
        ),
      risk_category: z.enum([
        "Promissory",
        "Guarantee",
        "Suitability",
        "Misleading",
        "Unauthorized",
      ]),
      severity: z.enum(["high", "medium", "low"]),
      explanation: z
        .string()
        .describe(
          "Brief explanation of why this is a compliance risk and a suggested fix"
        ),
    })
  ),
  overall_risk_level: z
    .enum(["clean", "low", "medium", "high"])
    .describe("Overall compliance risk assessment of the email draft"),
});

export type ComplianceFlagType = z.infer<typeof ComplianceFlagSchema>;
