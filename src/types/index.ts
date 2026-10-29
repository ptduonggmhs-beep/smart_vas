export type PainContext = 'nghi' | 'hoat_dong' | 'van_dong'; // 'van_dong' giữ lại để tương thích dữ liệu cũ

export type TimePoint =
  | 'T0'
  | 'T1'
  | 'T2'
  | 'T6'
  | 'T6h'
  | 'T12'
  | 'T12h'
  | 'T24'
  | 'T24h'
  | 'T48'
  | 'T48h'
  | 'Rescue_Pre'
  | 'Rescue_Post'
  | 'Khác';

export type ActivityTiming = 'trong_hoat_dong' | 'ngay_sau_hoat_dong';

export type ReasonNotCompleted =
  | 'chua_duoc_cho_phep' // Chưa được cho phép
  | 'khong_phu_hop_lam_sang' // Không phù hợp về lâm sàng
  | 'khong_the_thuc_hien' // Người bệnh không thể thực hiện
  | 'tu_choi' // Người bệnh từ chối
  | 'can_ho_tro' // Cần hỗ trợ
  | 'loi_ky_thuat' // Lỗi kỹ thuật
  | 'ly_do_khac'; // Lý do khác

export type CompletionStatus = 'completed' | 'not_completed' | 'abandoned';

export type AssistanceStatus = 'self' | 'assisted';

export type SaveStatus = 'success' | 'failed' | 'offline_cached';

export type DeviceType = 'ios' | 'android' | 'web';

export type ActivityExecutionStatus =
  | 'da_thuc_hien' // Đã thực hiện hoạt động
  | 'chua_thuc_hien' // Chưa thực hiện hoạt động
  | 'khong_duoc_phep' // Không được phép thực hiện hoạt động theo kế hoạch hiện tại
  | 'khong_the_hoan_thanh'; // Đã thực hiện nhưng không thể hoàn thành đánh giá

export interface TimepointConfigItem {
  key: string;
  label: string;
  description: string;
  nominalHours?: number;
}

export interface Patient {
  study_id: string; // Primary Key / MSBA (e.g. 001, CS001)
  medical_record_number?: string | null; // Mã số bệnh án (MSBA)
  patient_name?: string | null; // Họ và tên bệnh nhân
  birth_year?: number | string | null; // Năm sinh
  t0_timestamp?: string | null; // Thời điểm tham chiếu T0
  custom_timepoints?: TimepointConfigItem[] | null; // Các mốc T do bác sĩ thiết lập tùy ý
  age?: number | null;
  para?: string | null;
  anesthesia_method?: string | null; // e.g. Tê tủy sống, Mê toàn thân
  analgesia_drugs?: string | null; // e.g. Morphin, Paracetamol
  paper_vas_score?: number | null; // Điểm VAS giấy đối chiếu
  drug_administration_time?: string | null;
  surgery_group?: string | null; // Nhóm / vị trí phẫu thuật (dữ liệu cũ)
  care_location?: string | null; // Khu vực chăm sóc
  created_at: string;
  created_by?: string; // ID người tạo hồ sơ (vd: 'ncv-01' hoặc 'admin-01')
  created_by_name?: string; // Tên hiển thị người tạo hồ sơ
  notes?: string;
}

export type TimepointStatus = 'BASELINE' | 'ON_TIME' | 'EARLY' | 'OUT_OF_WINDOW';

export interface TimepointEvaluation {
  status: TimepointStatus;
  timepointLabel: string;
  plannedTimepoint: string | null;
  isEarly: boolean;
  elapsedMinutes: number;
  nominalTargetTime?: Date | null;
  windowStart?: Date | null;
  windowEnd?: Date | null;
  isFirstAssessment?: boolean;
  warningType?: 'NONE' | 'EARLY_T1' | 'OUT_OF_WINDOW';
  warningTitle?: string;
  warningMessage?: string;
  // Aliases
  timepoint_status?: TimepointStatus;
  timepoint_label?: string;
  planned_timepoint?: string | null;
  is_early?: boolean;
  is_out_of_window?: boolean;
  is_t0?: boolean;
  elapsed_minutes_from_T0?: number;
  actual_timestamp?: string;
}

export interface PatientEpisode {
  episode_id: string;
  patient_code: string;
  t0_timestamp: string; // ISO DateTime của lần đánh giá đầu tiên thành công
  created_at: string;
  is_active: boolean;
}

export interface Assessment {
  assessment_id: string; // Primary Key (UUID)
  record_id?: string; // Tương đương assessment_id
  study_id: string; // Mã người tham gia / MSBA (CS001, 001)
  patient_code?: string; // Tương đương study_id
  medical_record_number?: string | null; // Mã số bệnh án (MSBA)
  episode_id?: string; // Mã đợt theo dõi của bệnh nhân
  assessment_timepoint: TimePoint; // Mốc thời gian tương thích cũ
  selected_timepoint?: 'T1' | 'T6' | 'T12' | 'T24' | string | null; // Mốc đánh giá đau chọn thủ công
  assessment_order?: number; // Số thứ tự bản ghi trong cùng mốc hoặc phiên
  t0_timestamp?: string | null; // Mốc T0 tham chiếu nếu có
  pain_context: PainContext; // 'nghi' | 'hoat_dong' | 'van_dong'
  activity_group?: string | null; // Nhóm hoạt động (1 trong 6 nhóm lâm sàng)
  activity_name?: string | null; // Tên hoạt động cụ thể
  activity_timing?: ActivityTiming | null; // Thời điểm đo
  activity_execution_status?: ActivityExecutionStatus | null; // Trạng thái thực hiện
  surgery_group?: string | null; // Nhóm / vị trí phẫu thuật
  care_location?: string | null; // Khu vực chăm sóc
  eVAS_score: number | null; // 0.0 - 100.0 (mm) - null nếu không hoàn thành / không áp dụng
  vas_score?: number | null; // Tương đương eVAS_score
  start_timestamp: string; // ISO DateTime
  submit_timestamp: string; // ISO DateTime
  actual_timestamp?: string; // ISO DateTime thực tế của đánh giá
  timezone?: string; // Múi giờ ghi nhận (vd: Asia/Ho_Chi_Minh)
  elapsed_minutes_from_T0?: number; // Số phút thực tế trôi qua từ mốc T0 gốc
  timepoint_label?: string; // Nhãn thời điểm: 'T0', 'T1', 'T6', 'T12', 'T24',...
  planned_timepoint?: string | null; // Mốc danh nghĩa dự kiến
  timepoint_status?: TimepointStatus; // 'BASELINE' | 'ON_TIME' | 'EARLY' | 'OUT_OF_WINDOW'
  is_early?: boolean; // Đánh dấu nếu đánh giá sớm trước cửa sổ T1
  duration_seconds: number; // Thời gian thao tác (giây)
  completion_status: CompletionStatus; // 'completed' | 'not_completed' | 'abandoned'
  reason_not_completed?: ReasonNotCompleted | string | null; // Lý do không hoàn thành
  technical_issue?: string | null; // Lỗi kỹ thuật nếu có
  assistance_status: AssistanceStatus; // 'self' | 'assisted'
  device_type: DeviceType;
  app_version: string;
  save_status: SaveStatus;
  error_code?: string | null;
  is_primary_assessment?: boolean; // Đánh giá chính thức của mốc T
}

export type AssessmentFlowStep =
  | 'welcome'
  | 'quick_vas'
  | 'patient_list'
  | 'patient_detail'
  | 'patient_vas'
  | 'summary_table'
  | 'identify'
  | 'context'
  | 'measure'
  | 'confirm';

export type UserRole = 'patient' | 'ncv' | 'admin';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  title?: string; // e.g. "Bác sĩ Nghiên cứu viên", "Chủ nhiệm đề tài"
}

export interface ResearcherAccount extends AppUser {
  pin: string; // Mã PIN đăng nhập nhanh (4 - 6 số)
  password?: string; // Mật khẩu đăng nhập bằng email (tùy chọn)
  created_at: string;
  updated_at?: string;
  is_active?: boolean;
}

// Cấu hình lâm sàng
export interface ClinicalActivityGroupItem {
  id: string;
  name: string;
  order: number;
  is_active: boolean;
  suggested_surgery_regions?: string[]; // Gợi ý nhóm phẫu thuật phù hợp
}

export interface ClinicalActivityItem {
  id: string;
  group_id?: string;
  group_name?: string;
  name: string;
  description?: string;
  is_active: boolean;
  order: number;
}

export interface ClinicalSurgeryGroupItem {
  id: string;
  name: string;
  is_active: boolean;
  order: number;
}

export interface ClinicalCareLocationItem {
  id: string;
  name: string;
  is_active: boolean;
  order: number;
}

export interface ClinicalConfig {
  activity_groups?: ClinicalActivityGroupItem[];
  activities: ClinicalActivityItem[];
  surgery_groups: ClinicalSurgeryGroupItem[];
  care_locations: ClinicalCareLocationItem[];
  anchor_left_label: string; // Mặc định: "Không đau"
  anchor_right_label: string; // Mặc định: "Đau dữ dội nhất có thể tưởng tượng"
  rounding_decimals: number; // Mặc định: 1 (làm tròn 0.1 mm)
  updated_at?: string;
}
