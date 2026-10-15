import AsyncStorage from '@react-native-async-storage/async-storage';
import { Assessment, Patient } from '../types';

const STORAGE_KEYS = {
  ASSESSMENTS: '@smart_vas_assessments',
  PATIENTS: '@smart_vas_patients',
  CURRENT_TIMEPOINT: '@smart_vas_current_timepoint',
  CURRENT_ASSISTANCE: '@smart_vas_current_assistance',
  CUSTOM_FIREBASE_KEY: '@smart_vas_custom_firebase_key',
  CACHED_PATIENT_STUDY_ID: '@smart_vas_cached_patient_study_id',
};

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
        return JSON.parse(data);
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
        },
        {
          study_id: 'CS002',
          age: 32,
          para: '2002',
          anesthesia_method: 'Tê tủy sống',
          analgesia_drugs: 'Sufentanil + Paracetamol',
          created_at: new Date().toISOString(),
        },
        {
          study_id: 'CS003',
          age: 25,
          para: '0000',
          anesthesia_method: 'Mê nội khí quản',
          analgesia_drugs: 'PCA Fentanyl',
          created_at: new Date().toISOString(),
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

  async getPatientById(studyId: string): Promise<Patient | undefined> {
    const list = await this.getLocalPatients();
    return list.find(p => p.study_id.toUpperCase() === studyId.trim().toUpperCase());
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
