import type { PIIEntity, RedactionResult } from "@/types/database";

interface PIIPattern {
  type: PIIEntity["type"];
  regex: RegExp;
  label: string;
}

const PII_PATTERNS: PIIPattern[] = [
  {
    type: "ssn",
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    label: "SSN",
  },
  {
    type: "ssn",
    regex: /(?:ending\s+in|last\s+four|last\s+4)\s*(\d{4})/gi,
    label: "SSN_PARTIAL",
  },
  {
    type: "email",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    label: "EMAIL",
  },
  {
    type: "phone",
    regex: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    label: "PHONE",
  },
  {
    type: "account_number",
    regex: /\b\d{9,12}\b/g,
    label: "ACCOUNT",
  },
];

export function redactPII(text: string): RedactionResult {
  const entities: PIIEntity[] = [];
  let redactedText = text;
  let offset = 0;

  const allMatches: {
    type: PIIEntity["type"];
    match: RegExpExecArray;
    label: string;
  }[] = [];

  for (const pattern of PII_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      allMatches.push({ type: pattern.type, match, label: pattern.label });
    }
  }

  // Sort by position to handle offsets correctly
  allMatches.sort((a, b) => a.match.index - b.match.index);

  // Deduplicate overlapping matches
  const deduplicated: typeof allMatches = [];
  for (const item of allMatches) {
    const start = item.match.index;
    const end = start + item.match[0].length;
    const overlaps = deduplicated.some((existing) => {
      const eStart = existing.match.index;
      const eEnd = eStart + existing.match[0].length;
      return start < eEnd && end > eStart;
    });
    if (!overlaps) {
      deduplicated.push(item);
    }
  }

  for (const { type, match, label } of deduplicated) {
    const original = match[0];
    const replacement = `[REDACTED_${label}]`;
    const startIndex = match.index + offset;

    entities.push({
      type,
      original,
      replacement,
      startIndex: match.index,
      endIndex: match.index + original.length,
    });

    redactedText =
      redactedText.slice(0, startIndex) +
      replacement +
      redactedText.slice(startIndex + original.length);

    offset += replacement.length - original.length;
  }

  return { redactedText, entities };
}

export function getPIISummary(entities: PIIEntity[]): string {
  if (entities.length === 0) return "No PII detected";
  const counts: Record<string, number> = {};
  for (const e of entities) {
    counts[e.type] = (counts[e.type] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`)
    .join(", ");
}
