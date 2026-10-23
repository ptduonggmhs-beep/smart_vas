import AsyncStorage from '@react-native-async-storage/async-storage';
import { Assessment, Patient, ResearcherAccount } from '../types';

const STORAGE_KEYS = {
  ASSESSMENTS: '@smart_vas_assessments',
  PATIENTS: '@smart_vas_patients',
  RESEARCHERS: '@smart_vas_researchers',
  CURRENT_TIMEPOINT: '@smart_vas_current_timepoint',
  CURRENT_ASSISTANCE: '@smart_vas_current_assistance',
  CUSTOM_FIREBASE_KEY: '@smart_vas_custom_firebase_key',
  CACHED_PATIENT_STUDY_ID: '@smart_vas_cached_patient_study_id',
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
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading local assessments:', e);
      return [];
    }
  },

  async saveLocalAssessment(assessment: Assessment): Promise<void> {
    try {
      const list = await this.getLocalAssessments();
      // Replace if existing assessment_id or prepend new
      const index = list.findIndex(a => a.assessment_id === assessment.assessment_id);
      if (index >= 0) {
        list[index] = assessment;
      } else {
        list.unshift(assessment);
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

  // --- Patients ---
  async getLocalPatients(): Promise<Patient[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PATIENTS);
      if (data) {
        const parsed: Patient[] = JSON.parse(data);
        // Migration: Gán người tạo cho các bản ghi cũ chưa có thông tin created_by
        let hasChanges = false;
        const migrated = parsed.map((p) => {
          if (!p.created_by) {
            hasChanges = true;
            if (p.study_id.toUpperCase() === 'CS002') {
              return {
                ...p,
                created_by: 'ncv-01',
                created_by_name: 'BS. Nghiên cứu viên Lâm sàng',
              };
            }
            return {
              ...p,
              created_by: 'admin-01',
              created_by_name: 'PGS. TS. Chủ nhiệm Đề tài',
            };
          }
          return p;
        });

        if (hasChanges) {
          await AsyncStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(migrated));
        }
        return migrated;
      }
      // Dữ liệu ban đầu mặc định đã đăng ký trong đề cương
      const initialList: Patient[] = [
        {
          study_id: 'CS001',
          age: 28,
          para: '1001',
          anesthesia_method: 'Tê tủy sống',
          analgesia_drugs: 'Morphin tủy sống + Paracetamol',
          created_at: new Date().toISOString(),
          created_by: 'admin-01',
          created_by_name: 'PGS. TS. Chủ nhiệm Đề tài',
        },
        {
          study_id: 'CS002',
          age: 32,
          para: '2002',
          anesthesia_method: 'Tê tủy sống',
          analgesia_drugs: 'Sufentanil + Paracetamol',
          created_at: new Date().toISOString(),
          created_by: 'ncv-01',
          created_by_name: 'BS. Nghiên cứu viên Lâm sàng',
        },
        {
          study_id: 'CS003',
          age: 25,
          para: '0000',
          anesthesia_method: 'Mê nội khí quản',
          analgesia_drugs: 'PCA Fentanyl',
          created_at: new Date().toISOString(),
          created_by: 'admin-01',
          created_by_name: 'PGS. TS. Chủ nhiệm Đề tài',
        },
      ];
      await AsyncStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(initialList));
      return initialList;
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
      const list = await this.getLocalPatients();
      const filtered = list.filter(p => p.study_id.toUpperCase() !== studyId.trim().toUpperCase());
      await AsyncStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(filtered));
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
};
