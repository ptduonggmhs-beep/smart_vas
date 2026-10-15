import { doc, setDoc, getDoc, collection, getDocs, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Assessment, Patient, SaveStatus } from '../types';
import { StorageService } from './storageService';

const PATIENTS_COLLECTION = 'patients';
const ASSESSMENTS_COLLECTION = 'assessments';

export const FirebaseService = {
  /**
   * Lưu hoặc cập nhật hồ sơ sản phụ (Table Patients)
   */
  async savePatient(patient: Patient): Promise<{ success: boolean; error?: string }> {
    // 1. Luôn lưu vào Local Cache trước
    await StorageService.saveLocalPatient(patient);

    // 2. Thử đồng bộ lên Firestore
    if (!db) {
      return { success: false, error: 'Chưa khởi tạo kết nối Firestore' };
    }

    try {
      const patientRef = doc(db, PATIENTS_COLLECTION, patient.study_id.toUpperCase());
      await setDoc(
        patientRef,
        {
          study_id: patient.study_id.toUpperCase(),
          age: patient.age ?? null,
          para: patient.para ?? null,
          anesthesia_method: patient.anesthesia_method ?? null,
          analgesia_drugs: patient.analgesia_drugs ?? null,
          paper_vas_score: patient.paper_vas_score ?? null,
          drug_administration_time: patient.drug_administration_time ?? null,
          created_at: patient.created_at,
          notes: patient.notes ?? null,
          synced_at: serverTimestamp(),
        },
        { merge: true }
      );
      return { success: true };
    } catch (err: any) {
      console.warn('Lỗi lưu Patient lên Firestore (đã lưu local):', err?.message);
      return { success: false, error: err?.message || 'Lỗi mạng hoặc phân quyền Firestore' };
    }
  },

  /**
   * Lưu phiên đánh giá điểm đau eVAS (Table Assessments)
   */
  async saveAssessment(assessment: Assessment): Promise<{ success: boolean; save_status: SaveStatus; error?: string }> {
    let finalSaveStatus: SaveStatus = 'offline_cached';
    let errorCode: string | null = null;

    // 1. Thử ghi lên Firestore trước
    if (db) {
      try {
        const assessmentRef = doc(db, ASSESSMENTS_COLLECTION, assessment.assessment_id);
        await setDoc(assessmentRef, {
          assessment_id: assessment.assessment_id,
          study_id: assessment.study_id.toUpperCase(),
          assessment_timepoint: assessment.assessment_timepoint,
          pain_context: assessment.pain_context,
          eVAS_score: Number(assessment.eVAS_score.toFixed(1)),
          start_timestamp: assessment.start_timestamp,
          submit_timestamp: assessment.submit_timestamp,
          duration_seconds: assessment.duration_seconds,
          completion_status: assessment.completion_status,
          assistance_status: assessment.assistance_status,
          device_type: assessment.device_type,
          app_version: assessment.app_version,
          save_status: 'success',
          error_code: null,
          synced_at: serverTimestamp(),
        });
        finalSaveStatus = 'success';
      } catch (err: any) {
        console.warn('Firestore write failed, fallback to local storage:', err?.message);
        finalSaveStatus = 'failed';
        errorCode = err?.message || 'Firestore_Connection_Error';
      }
    } else {
      errorCode = 'No_Firestore_Instance';
      finalSaveStatus = 'offline_cached';
    }

    // 2. Cập nhật trạng thái và lưu vào Local Cache (AsyncStorage)
    const assessmentToSave: Assessment = {
      ...assessment,
      save_status: finalSaveStatus,
      error_code: errorCode,
    };
    await StorageService.saveLocalAssessment(assessmentToSave);

    return {
      success: finalSaveStatus === 'success',
      save_status: finalSaveStatus,
      error: errorCode ?? undefined,
    };
  },

  /**
   * Lấy danh sách tất cả các đánh giá (từ Firestore hoặc Local fallback)
   */
  async getAllAssessments(): Promise<Assessment[]> {
    if (db) {
      try {
        const q = query(collection(db, ASSESSMENTS_COLLECTION), orderBy('submit_timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        const list: Assessment[] = [];
        querySnapshot.forEach((docSnapshot) => {
          list.push(docSnapshot.data() as Assessment);
        });
        if (list.length > 0) {
          return list;
        }
      } catch (err: any) {
        console.warn('Không thể load từ Firestore, chuyển sang đọc bộ nhớ máy:', err?.message);
      }
    }
    // Fallback local
    return StorageService.getLocalAssessments();
  },

  /**
   * Lấy danh sách đánh giá của 1 bệnh nhân cụ thể theo study_id
   */
  async getAssessmentsByPatient(studyId: string): Promise<Assessment[]> {
    const all = await this.getAllAssessments();
    return all.filter((a) => a.study_id.toUpperCase() === studyId.trim().toUpperCase());
  },

  /**
   * Lấy thông tin bệnh nhân theo study_id
   */
  async getPatient(studyId: string): Promise<Patient | null> {
    const normalizedId = studyId.trim().toUpperCase();
    if (db) {
      try {
        const patientRef = doc(db, PATIENTS_COLLECTION, normalizedId);
        const snap = await getDoc(patientRef);
        if (snap.exists()) {
          return snap.data() as Patient;
        }
      } catch (e) {
        console.warn('Lỗi đọc Firestore Patient:', e);
      }
    }
    const local = await StorageService.getPatientById(normalizedId);
    return local || null;
  },

  /**
   * Lấy danh sách tất cả hồ sơ bệnh nhân (từ Firestore kết hợp Local cache)
   */
  async getAllPatients(): Promise<Patient[]> {
    const localPatients = await StorageService.getLocalPatients();
    if (db) {
      try {
        const q = query(collection(db, PATIENTS_COLLECTION));
        const querySnapshot = await getDocs(q);
        const remoteMap = new Map<string, Patient>();
        querySnapshot.forEach((docSnapshot) => {
          const p = docSnapshot.data() as Patient;
          if (p && p.study_id) {
            remoteMap.set(p.study_id.toUpperCase(), p);
          }
        });

        if (remoteMap.size > 0) {
          const mergedMap = new Map<string, Patient>();
          localPatients.forEach((p) => mergedMap.set(p.study_id.toUpperCase(), p));
          remoteMap.forEach((v, k) => mergedMap.set(k, v));
          return Array.from(mergedMap.values());
        }
      } catch (err: any) {
        console.warn('Không thể load Patients từ Firestore, chuyển sang đọc bộ nhớ máy:', err?.message);
      }
    }
    return localPatients;
  },

  /**
   * Đồng bộ lại tất cả các bản ghi offline lên Firestore
   */
  async syncOfflineData(): Promise<{ total: number; synced: number; failed: number }> {
    const localAssessments = await StorageService.getLocalAssessments();
    const unsynced = localAssessments.filter((a) => a.save_status !== 'success');
    let synced = 0;
    let failed = 0;

    for (const item of unsynced) {
      const res = await this.saveAssessment({
        ...item,
        save_status: 'offline_cached',
      });
      if (res.success) {
        synced++;
      } else {
        failed++;
      }
    }

    return { total: unsynced.length, synced, failed };
  },

  /**
   * Xuất dữ liệu sang định dạng CSV phục vụ nghiên cứu lâm sàng
   */
  exportToCSV(assessments: Assessment[]): string {
    const headers = [
      'Mã nghiên cứu (study_id)',
      'Mã đánh giá (assessment_id)',
      'Mốc thời gian (timepoint)',
      'Bối cảnh đau (pain_context)',
      'Điểm eVAS (0-100)',
      'Bắt đầu (start_time)',
      'Xác nhận (submit_time)',
      'Thời gian làm (giây)',
      'Trạng thái hoàn thành',
      'Hỗ trợ',
      'Thiết bị',
      'Phiên bản App',
      'Trạng thái đồng bộ',
      'Mã lỗi',
    ];

    const rows = assessments.map((a) => [
      `"${a.study_id}"`,
      `"${a.assessment_id}"`,
      `"${a.assessment_timepoint}"`,
      `"${a.pain_context === 'nghi' ? 'Lúc nghỉ' : 'Khi vận động'}"`,
      a.eVAS_score.toFixed(1),
      `"${a.start_timestamp}"`,
      `"${a.submit_timestamp}"`,
      a.duration_seconds,
      `"${a.completion_status}"`,
      `"${a.assistance_status === 'self' ? 'Tự làm' : 'Có hỗ trợ'}"`,
      `"${a.device_type}"`,
      `"${a.app_version}"`,
      `"${a.save_status}"`,
      `"${a.error_code || ''}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },
};
