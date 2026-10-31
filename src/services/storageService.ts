import AsyncStorage from '@react-native-async-storage/async-storage';
import { Assessment, Patient, ResearcherAccount, ClinicalConfig, PatientEpisode, TimepointConfigItem } from '../types';
import { DEFAULT_CLINICAL_CONFIG } from '../config/clinicalConfig';
import { DEFAULT_CLINICAL_TIMEPOINTS } from '../config/timepointConfig';

const STORAGE_KEYS = {
  ASSESSMENTS: '@smart_vas_assessments',
  PATIENTS: '@smart_vas_patients',
  RESEARCHERS: '@smart_vas_researchers',
  EPISODES: '@smart_vas_episodes',
  CURRENT_TIMEPOINT: '@smart_vas_current_timepoint',
  CURRENT_ASSISTANCE: '@smart_vas_current_assistance',
  CUSTOM_FIREBASE_KEY: '@smart_vas_custom_firebase_key',
  CACHED_PATIENT_STUDY_ID: '@smart_vas_cached_patient_study_id',
  CLINICAL_CONFIG: '@smart_vas_clinical_config',
  DOCTOR_TIMEPOINTS: '@smart_vas_doctor_timepoints',
};

export const INITIAL_SEED_RESEARCHERS: ResearcherAccount[] = [
  {
    id: 'admin-01',
    email: 'admin@smartvas.vn',
    name: 'PGS. TS. Chủ nhiệm Đề tài',
    role: 'admin',
    title: 'Quản trị viên Đề tài (Admin)',
    pin: '9999',
    password: 'admin123456',
    created_at: new Date().toISOString(),
    is_active: true,
  },
  {
    id: 'ncv-01',
    email: 'ncv@smartvas.vn',
    name: 'BS. Nghiên cứu viên Lâm sàng',
    role: 'ncv',
    title: 'Nghiên cứu viên (NCV)',
    pin: '8888',
    password: 'ncv123456',
    created_at: new Date().toISOString(),
    is_active: true,
  },
];

export const StorageService = {
  // --- Assessments ---
  async getLocalAssessments(): Promise<Assessment[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
      if (!data) return [];
      const parsed: any[] = JSON.parse(data);

      let hasChanges = false;
      const migrated: Assessment[] = parsed.map((item) => {
        // Migration schema:
        // 1. pain_context 'van_dong' -> 'hoat_dong'
        let painContext = item.pain_context;
        if (painContext === 'van_dong') {
          painContext = 'hoat_dong';
          hasChanges = true;
        }

        // 2. Bổ sung các trường mới nếu bản ghi cũ chưa có
        const normalized: Assessment = {
          ...item,
          pain_context: painContext,
          activity_name: item.activity_name ?? null,
          activity_timing: item.activity_timing ?? null,
          surgery_group: item.surgery_group ?? null,
          care_location: item.care_location ?? null,
          completion_status: item.completion_status || 'completed',
          reason_not_completed: item.reason_not_completed ?? null,
          technical_issue: item.technical_issue ?? null,
          eVAS_score: typeof item.eVAS_score === 'number' ? item.eVAS_score : (item.completion_status === 'not_completed' ? null : 0),
        };

        if (
          item.activity_name === undefined ||
          item.surgery_group === undefined ||
          item.care_location === undefined
        ) {
          hasChanges = true;
        }

        return normalized;
      });

      if (hasChanges) {
        await AsyncStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(migrated));
      }

      return migrated;
    } catch (e) {
      console.error('Error reading local assessments:', e);
      return [];
    }
  },

  async saveLocalAssessment(assessment: Assessment): Promise<void> {
    try {
      const list = await this.getLocalAssessments();
      const patientCode = (assessment.patient_code || assessment.study_id).trim().toUpperCase();
      const actualTime = assessment.actual_timestamp || assessment.submit_timestamp || new Date().toISOString();

      // Đảm bảo các trường tiêu chuẩn của Phần 7 luôn đầy đủ
      const normalizedAssessment: Assessment = {
        ...assessment,
        study_id: patientCode,
        patient_code: patientCode,
        record_id: assessment.record_id || assessment.assessment_id,
        assessment_id: assessment.record_id || assessment.assessment_id,
        selected_timepoint: assessment.selected_timepoint || assessment.timepoint_label || (assessment.assessment_timepoint as string) || null,
        assessment_order: assessment.assessment_order ?? 1,
        t0_timestamp: assessment.t0_timestamp || null,
        vas_score: assessment.vas_score !== undefined ? assessment.vas_score : assessment.eVAS_score,
        eVAS_score: assessment.vas_score !== undefined ? assessment.vas_score : assessment.eVAS_score,
        actual_timestamp: actualTime,
        submit_timestamp: actualTime,
        timezone: assessment.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
        elapsed_minutes_from_T0: assessment.elapsed_minutes_from_T0,
        timepoint_label: assessment.timepoint_label || (assessment.selected_timepoint as string) || (assessment.assessment_timepoint as string) || 'T1',
        planned_timepoint: assessment.planned_timepoint ?? (assessment.selected_timepoint as string) ?? (assessment.assessment_timepoint as string),
        timepoint_status: assessment.timepoint_status || (assessment.timepoint_label === 'T0' ? 'BASELINE' : 'ON_TIME'),
        is_early: assessment.is_early ?? false,
      };

      // Nếu lần đánh giá hoàn thành đầu tiên được lưu thành công (BASELINE/T0), tạo hoặc kích hoạt Episode
      if (
        normalizedAssessment.completion_status === 'completed' &&
        (normalizedAssessment.timepoint_status === 'BASELINE' || normalizedAssessment.timepoint_label === 'T0')
      ) {
        let activeEp = await this.getActiveEpisode(patientCode);
        if (!activeEp) {
          activeEp = await this.createEpisode(patientCode, actualTime);
        }
        normalizedAssessment.episode_id = activeEp.episode_id;
      }

      // Replace if existing assessment_id or prepend new
      const index = list.findIndex(a => a.assessment_id === normalizedAssessment.assessment_id);
      if (index >= 0) {
        list[index] = normalizedAssessment;
      } else {
        list.unshift(normalizedAssessment);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving local assessment:', e);
    }
  },

  async updateAssessmentStatus(assessmentId: string, status: Assessment['save_status'], error?: string | null): Promise<void> {
    try {
      const list = await this.getLocalAssessments();
      const updated = list.map(item => {
        if (item.assessment_id === assessmentId) {
          return { ...item, save_status: status, error_code: error ?? item.error_code };
        }
        return item;
      });
      await AsyncStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(updated));
    } catch (e) {
      console.error('Error updating assessment status:', e);
    }
  },

  async deleteLocalAssessment(assessmentId: string): Promise<void> {
    try {
      const list = await this.getLocalAssessments();
      const filtered = list.filter(a => a.assessment_id !== assessmentId);
      await AsyncStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(filtered));
    } catch (e) {
      console.error('Error deleting local assessment:', e);
    }
  },

  async deleteLocalAssessmentsByPatient(studyId: string): Promise<void> {
    try {
      const list = await this.getLocalAssessments();
      const filtered = list.filter(a => a.study_id.toUpperCase() !== studyId.trim().toUpperCase());
      await AsyncStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(filtered));
    } catch (e) {
      console.error('Error deleting local assessments by patient:', e);
    }
  },

  async clearAllLocalAssessments(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ASSESSMENTS);
    } catch (e) {
      console.error('Error clearing local assessments:', e);
    }
  },


  // --- Patients ---
  async getLocalPatients(): Promise<Patient[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PATIENTS);
      if (data) {
        const parsed: Patient[] = JSON.parse(data);
        // Lọc bỏ các bản ghi mẫu mặc định ban đầu nếu còn trong bộ nhớ máy
        const filtered = parsed.filter(
          (p) =>
            !(
              (p.study_id === 'CS001' && p.para === '1001' && p.anesthesia_method === 'Tê tủy sống') ||
              (p.study_id === 'CS002' && p.para === '2002' && p.anesthesia_method === 'Tê tủy sống') ||
              (p.study_id === 'CS003' && p.para === '0000' && p.anesthesia_method === 'Mê nội khí quản')
            )
        );
        if (filtered.length !== parsed.length) {
          await AsyncStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(filtered));
        }
        return filtered;
      }
      return [];
    } catch (e) {
      console.error('Error reading local patients:', e);
      return [];
    }
  },

  async saveLocalPatient(patient: Patient): Promise<void> {
    try {
      const list = await this.getLocalPatients();
      const index = list.findIndex(p => p.study_id.toUpperCase() === patient.study_id.toUpperCase());
      if (index >= 0) {
        list[index] = { ...list[index], ...patient };
      } else {
        list.push(patient);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving local patient:', e);
    }
  },

  async saveAllLocalPatients(patients: Patient[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
    } catch (e) {
      console.error('Error saving all local patients:', e);
    }
  },

  async deleteLocalPatient(studyId: string): Promise<void> {
    try {
      const normalized = studyId.trim().toUpperCase();
      const list = await this.getLocalPatients();
      const filtered = list.filter(p => p.study_id.toUpperCase() !== normalized);
      await AsyncStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(filtered));

      // Dọn dẹp các đánh giá và đợt theo dõi liên quan của bệnh nhân
      const assessments = await this.getLocalAssessments();
      const filteredAssessments = assessments.filter(
        a => (a.study_id || '').toUpperCase() !== normalized
      );
      await AsyncStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(filteredAssessments));

      const episodes = await this.getAllEpisodes();
      const filteredEpisodes = episodes.filter(
        e => (e.patient_code || '').toUpperCase() !== normalized
      );
      await AsyncStorage.setItem(STORAGE_KEYS.EPISODES, JSON.stringify(filteredEpisodes));
    } catch (e) {
      console.error('Error deleting local patient:', e);
    }
  },

  async getPatientById(studyId: string): Promise<Patient | undefined> {
    const list = await this.getLocalPatients();
    return list.find(p => p.study_id.toUpperCase() === studyId.trim().toUpperCase());
  },

  // --- Researchers & PINs ---
  async getLocalResearchers(): Promise<ResearcherAccount[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.RESEARCHERS);
      if (data) {
        return JSON.parse(data);
      }
      // Dữ liệu tài khoản ban đầu cho CSDL nếu bộ nhớ hoàn toàn trống
      await AsyncStorage.setItem(STORAGE_KEYS.RESEARCHERS, JSON.stringify(INITIAL_SEED_RESEARCHERS));
      return INITIAL_SEED_RESEARCHERS;
    } catch (e) {
      console.error('Error reading local researchers:', e);
      return INITIAL_SEED_RESEARCHERS;
    }
  },

  async saveLocalResearcher(account: ResearcherAccount): Promise<void> {
    try {
      const list = await this.getLocalResearchers();
      const index = list.findIndex(r => r.id === account.id);
      if (index >= 0) {
        list[index] = { ...list[index], ...account };
      } else {
        list.push(account);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.RESEARCHERS, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving local researcher:', e);
    }
  },

  async saveAllLocalResearchers(accounts: ResearcherAccount[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RESEARCHERS, JSON.stringify(accounts));
    } catch (e) {
      console.error('Error saving all local researchers:', e);
    }
  },

  async deleteLocalResearcher(id: string): Promise<void> {
    try {
      const list = await this.getLocalResearchers();
      const filtered = list.filter(r => r.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.RESEARCHERS, JSON.stringify(filtered));
    } catch (e) {
      console.error('Error deleting local researcher:', e);
    }
  },

  async getLocalResearcherByPin(pin: string): Promise<ResearcherAccount | undefined> {
    const list = await this.getLocalResearchers();
    return list.find(r => r.pin.trim() === pin.trim() && r.is_active !== false);
  },

  async getLocalResearcherByEmail(email: string): Promise<ResearcherAccount | undefined> {
    const list = await this.getLocalResearchers();
    return list.find(r => r.email.toLowerCase().trim() === email.toLowerCase().trim() && r.is_active !== false);
  },

  // --- Clinical Configurations ---
  async getClinicalConfig(): Promise<ClinicalConfig> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CLINICAL_CONFIG);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          ...DEFAULT_CLINICAL_CONFIG,
          ...parsed,
        };
      }
    } catch (e) {
      console.warn('Lỗi đọc cấu hình lâm sàng từ storage, dùng cấu hình mặc định:', e);
    }
    return DEFAULT_CLINICAL_CONFIG;
  },

  async saveClinicalConfig(config: ClinicalConfig): Promise<void> {
    try {
      const toSave: ClinicalConfig = {
        ...config,
        updated_at: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.CLINICAL_CONFIG, JSON.stringify(toSave));
    } catch (e) {
      console.error('Lỗi lưu cấu hình lâm sàng:', e);
    }
  },

  // --- Doctor Custom Timepoints (Các mốc T do bác sĩ thiết lập) ---
  async getDoctorCustomTimepoints(): Promise<TimepointConfigItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DOCTOR_TIMEPOINTS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Lỗi đọc mốc T tùy chỉnh từ bộ nhớ:', e);
    }
    return DEFAULT_CLINICAL_TIMEPOINTS;
  },

  async saveDoctorCustomTimepoints(timepoints: TimepointConfigItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DOCTOR_TIMEPOINTS, JSON.stringify(timepoints));
    } catch (e) {
      console.error('Lỗi lưu mốc T tùy chỉnh:', e);
    }
  },

  // --- Settings & Meta ---
  async getSetting(key: string, defaultValue: string = ''): Promise<string> {
    try {
      const val = await AsyncStorage.getItem(`@smart_vas_${key}`);
      return val ?? defaultValue;
    } catch {
      return defaultValue;
    }
  },

  async setSetting(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`@smart_vas_${key}`, value);
    } catch (e) {
      console.error('Error saving setting:', e);
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ASSESSMENTS,
        STORAGE_KEYS.PATIENTS,
        STORAGE_KEYS.CACHED_PATIENT_STUDY_ID,
      ]);
    } catch (e) {
      console.error('Error clearing storage:', e);
    }
  },

  // --- Patient Study ID Caching ---
  async getCachedPatientStudyId(): Promise<string> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_PATIENT_STUDY_ID);
      return val ? val.trim().toUpperCase() : '';
    } catch {
      return '';
    }
  },

  async setCachedPatientStudyId(studyId: string): Promise<void> {
    try {
      const trimmed = studyId.trim().toUpperCase();
      if (trimmed) {
        await AsyncStorage.setItem(STORAGE_KEYS.CACHED_PATIENT_STUDY_ID, trimmed);
      }
    } catch (e) {
      console.error('Error saving cached study ID:', e);
    }
  },

  async clearCachedPatientStudyId(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_PATIENT_STUDY_ID);
    } catch (e) {
      console.error('Error removing cached study ID:', e);
    }
  },

  // --- Episodes (Đợt theo dõi T0/Tn) ---
  async getAllEpisodes(): Promise<PatientEpisode[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EPISODES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async getActiveEpisode(patientCode: string): Promise<PatientEpisode | null> {
    try {
      const normalizedCode = patientCode.trim().toUpperCase();
      const episodes = await this.getAllEpisodes();
      const active = episodes.find(e => e.patient_code === normalizedCode && e.is_active);
      if (active) return active;

      // Fallback: Tìm từ các đánh giá đã lưu nếu chưa có trong episodes table
      const assessments = await this.getLocalAssessments();
      const patientAssessments = assessments.filter(
        a => a.study_id.toUpperCase() === normalizedCode && a.completion_status === 'completed'
      );
      // Tìm bản ghi BASELINE hoặc T0 sớm nhất
      const t0Assessment = patientAssessments.find(
        a => a.timepoint_status === 'BASELINE' || a.timepoint_label === 'T0'
      ) || (patientAssessments.length > 0 ? patientAssessments[patientAssessments.length - 1] : null);

      if (t0Assessment) {
        const episode: PatientEpisode = {
          episode_id: t0Assessment.episode_id || `EP_${normalizedCode}_${new Date(t0Assessment.submit_timestamp).getTime()}`,
          patient_code: normalizedCode,
          t0_timestamp: t0Assessment.actual_timestamp || t0Assessment.submit_timestamp,
          created_at: t0Assessment.submit_timestamp,
          is_active: true,
        };
        await this.saveEpisode(episode);
        return episode;
      }

      return null;
    } catch (e) {
      console.error('Error getting active episode:', e);
      return null;
    }
  },

  async saveEpisode(episode: PatientEpisode): Promise<void> {
    try {
      const episodes = await this.getAllEpisodes();
      const index = episodes.findIndex(e => e.episode_id === episode.episode_id);
      if (index >= 0) {
        episodes[index] = episode;
      } else {
        episodes.unshift(episode);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.EPISODES, JSON.stringify(episodes));
    } catch (e) {
      console.error('Error saving episode:', e);
    }
  },

  async createEpisode(patientCode: string, t0Timestamp: string): Promise<PatientEpisode> {
    const normalizedCode = patientCode.trim().toUpperCase();
    const episodeId = `EP_${normalizedCode}_${Date.now()}`;
    const newEpisode: PatientEpisode = {
      episode_id: episodeId,
      patient_code: normalizedCode,
      t0_timestamp: t0Timestamp,
      created_at: new Date().toISOString(),
      is_active: true,
    };
    await this.saveEpisode(newEpisode);
    return newEpisode;
  },

  async deactivateActiveEpisode(patientCode: string): Promise<void> {
    try {
      const normalizedCode = patientCode.trim().toUpperCase();
      const episodes = await this.getAllEpisodes();
      const updated = episodes.map(e => {
        if (e.patient_code === normalizedCode && e.is_active) {
          return { ...e, is_active: false };
        }
        return e;
      });
      await AsyncStorage.setItem(STORAGE_KEYS.EPISODES, JSON.stringify(updated));
    } catch (e) {
      console.error('Error deactivating episode:', e);
    }
  },

  async updateActiveEpisodeT0(patientCode: string, t0Timestamp: string): Promise<void> {
    try {
      const normalizedCode = patientCode.trim().toUpperCase();
      const episodes = await this.getAllEpisodes();
      let found = false;
      const updated = episodes.map((e) => {
        if (e.patient_code === normalizedCode && e.is_active) {
          found = true;
          return { ...e, t0_timestamp: t0Timestamp };
        }
        return e;
      });
      if (!found) {
        await this.createEpisode(normalizedCode, t0Timestamp);
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.EPISODES, JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Error updating active episode T0:', e);
    }
  },

  /**
   * Xóa sạch toàn bộ dữ liệu bệnh nhân, đánh giá và đợt theo dõi trong bộ nhớ máy (Local Storage)
   * Phục vụ mục đích bảo mật thông tin bệnh nhân sau khi xuất file Excel
   */
  async clearAllPatientData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.PATIENTS,
        STORAGE_KEYS.ASSESSMENTS,
        STORAGE_KEYS.EPISODES,
        STORAGE_KEYS.CACHED_PATIENT_STUDY_ID,
        STORAGE_KEYS.CURRENT_TIMEPOINT,
        STORAGE_KEYS.CURRENT_ASSISTANCE,
      ]);
    } catch (e) {
      console.error('Error clearing local patient data:', e);
      throw e;
    }
  },
};

