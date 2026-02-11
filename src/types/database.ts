export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  risk_tolerance: 'Conservative' | 'Balanced' | 'Growth' | 'Aggressive';
  aum_value: number;
  status: 'Active' | 'Prospect' | 'Inactive';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  client_id: string;
  title: string;
  transcript_text: string;
  transcript_redacted: string | null;
  pii_entities: PIIEntity[];
  status: 'processing' | 'review_needed' | 'approved' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface MeetingWithClient extends Meeting {
  clients: Pick<Client, 'id' | 'name' | 'risk_tolerance' | 'aum_value'>;
}

export interface MeetingOutput {
  id: string;
  meeting_id: string;
  summary_text: string | null;
  key_topics: string[];
  client_email_draft: string | null;
  is_approved: boolean;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  meeting_id: string;
  client_id: string;
  description: string;
  due_date: string | null;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface TaskWithClient extends Task {
  clients: Pick<Client, 'id' | 'name'>;
}

export interface ComplianceFlag {
  id: string;
  meeting_output_id: string;
  flagged_text: string;
  risk_category: 'Promissory' | 'Guarantee' | 'Suitability' | 'Misleading' | 'Unauthorized';
  severity: 'high' | 'medium' | 'low';
  explanation: string | null;
  is_resolved: boolean;
  advisor_comment: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PIIEntity {
  type: 'phone' | 'email' | 'ssn' | 'account_number';
  original: string;
  replacement: string;
  startIndex: number;
  endIndex: number;
}

export interface RedactionResult {
  redactedText: string;
  entities: PIIEntity[];
}

export interface DashboardStats {
  totalAum: number;
  clientCount: number;
  meetingsThisMonth: number;
  pendingTasks: number;
  complianceFlags: number;
}
