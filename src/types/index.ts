export type PainContext = 'nghi' | 'van_dong';

export type TimePoint = 'T0' | 'T1' | 'T2' | 'T6h' | 'T12h' | 'T24h' | 'T48h' | 'Khác';

export type CompletionStatus = 'completed' | 'abandoned';

export type AssistanceStatus = 'self' | 'assisted';

export type SaveStatus = 'success' | 'failed' | 'offline_cached';

export type DeviceType = 'ios' | 'android' | 'web';

export interface Patient {
  study_id: string; // Primary Key (e.g. CS001)
  age?: number | null;
  para?: string | null;
  anesthesia_method?: string | null; // e.g. Tê tủy sống, Mê toàn thân
  analgesia_drugs?: string | null; // e.g. Morphin, Paracetamol
  paper_vas_score?: number | null; // Điểm VAS giấy đối chiếu
  drug_administration_time?: string | null;
  created_at: string;
  notes?: string;
}

export interface Assessment {
  assessment_id: string; // Primary Key (UUID)
  study_id: string; // Foreign Key to Patient
  assessment_timepoint: TimePoint;
  pain_context: PainContext;
  eVAS_score: number; // 0 - 100 (Float)
  start_timestamp: string; // ISO DateTime
  submit_timestamp: string; // ISO DateTime
  duration_seconds: number; // Thời gian thao tác (giây)
  completion_status: CompletionStatus;
  assistance_status: AssistanceStatus;
  device_type: DeviceType;
  app_version: string;
  save_status: SaveStatus;
  error_code?: string | null;
}

export type AssessmentFlowStep = 'identify' | 'context' | 'measure' | 'confirm';

export type UserRole = 'patient' | 'ncv' | 'admin';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  title?: string; // e.g. "Bác sĩ Nghiên cứu viên", "Chủ nhiệm đề tài"
}
