import { doc, setDoc, getDoc, collection, getDocs, query, orderBy, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Assessment, Patient, ResearcherAccount, SaveStatus, AppUser } from '../types';
import { StorageService, INITIAL_SEED_RESEARCHERS } from './storageService';
import { REASON_NOT_COMPLETED_LABELS, EXECUTION_STATUS_LABELS } from '../config/clinicalConfig';

const PATIENTS_COLLECTION = 'patients';
const ASSESSMENTS_COLLECTION = 'assessments';
const RESEARCHERS_COLLECTION = 'researchers';

export const FirebaseService = {
  /**
   * Kiểm tra tính hợp lệ bắt buộc của lượt đánh giá trước khi lưu
   */
  validateAssessment(assessment: Assessment): { valid: boolean; error?: string } {
    if (!assessment.study_id || !assessment.study_id.trim()) {
      return { valid: false, error: 'Mã người tham gia / nghiên cứu không được để trống.' };
    }

    if (!assessment.pain_context) {
      return { valid: false, error: 'Bối cảnh đánh giá (nghỉ hoặc hoạt động) là bắt buộc.' };
    }

    const isActivity = assessment.pain_context === 'hoat_dong' || assessment.pain_context === 'van_dong';

    // Trường hợp hoàn thành
    if (assessment.completion_status === 'completed') {
      if (typeof assessment.eVAS_score !== 'number' || isNaN(assessment.eVAS_score)) {
        return { valid: false, error: 'Điểm eVAS phải là một số hợp lệ khi hoàn thành đánh giá.' };
      }
      if (assessment.eVAS_score < 0 || assessment.eVAS_score > 100) {
        return { valid: false, error: 'Điểm eVAS phải nằm trong khoảng từ 0.0 đến 100.0 mm.' };
      }
      if (!assessment.start_timestamp || !assessment.submit_timestamp) {
        return { valid: false, error: 'Thời gian bắt đầu và kết thúc đánh giá là bắt buộc.' };
      }
      if (isActivity) {
        if (!assessment.activity_name || !assessment.activity_name.trim()) {
          return { valid: false, error: 'Khi đánh giá đau trong hoặc ngay sau hoạt động, bắt buộc phải chọn tên hoạt động cụ thể.' };
        }
      }
    }

    // Trường hợp không thực hiện / không áp dụng
    if (assessment.completion_status === 'not_completed') {
      if (!assessment.reason_not_completed || !String(assessment.reason_not_completed).trim()) {
        return { valid: false, error: 'Khi người bệnh không thực hiện hoặc không áp dụng, bắt buộc phải ghi nhận lý do.' };
      }
      if (assessment.eVAS_score !== null && assessment.eVAS_score !== undefined) {
        return { valid: false, error: 'Khi không thực hiện hoạt động, không được tạo điểm eVAS (phải để trống/null, không ghi điểm 0).' };
      }
    }

    return { valid: true };
  },

  /**
   * Lưu hoặc cập nhật hồ sơ sản phụ (Table Patients)
   * Phân quyền: Ai tạo bệnh nhân nào thì quản lý bệnh nhân đó, chỉ người tạo hoặc admin mới được sửa
   */
  async savePatient(
    patient: Patient,
    currentUser?: AppUser | null
  ): Promise<{ success: boolean; error?: string }> {
    const normalizedStudyId = patient.study_id.trim().toUpperCase();

    // 1. Kiểm tra quyền nếu hồ sơ đã tồn tại
    const existing = await this.getPatient(normalizedStudyId);
    if (existing && currentUser) {
      const isAdmin = currentUser.role === 'admin';
      const isCreator = existing.created_by === currentUser.id;
      if (!isAdmin && existing.created_by && !isCreator) {
        return {
          success: false,
          error: `Bạn không có quyền chỉnh sửa hồ sơ "${normalizedStudyId}" vì hồ sơ được tạo bởi nghiên cứu viên khác (${existing.created_by_name || 'NCV khác'}).`,
        };
      }
    }

    // 2. Xác định người tạo: nếu là tạo mới -> gán currentUser, nếu là sửa -> giữ nguyên người tạo ban đầu
    const createdBy = patient.created_by || existing?.created_by || currentUser?.id || 'admin-01';
    const createdByName =
      patient.created_by_name ||
      existing?.created_by_name ||
      currentUser?.name ||
      'PGS. TS. Chủ nhiệm Đề tài';

    const patientToSave: Patient = {
      ...patient,
      study_id: normalizedStudyId,
      created_by: createdBy,
      created_by_name: createdByName,
    };

    // 3. Luôn lưu vào Local Cache trước
    await StorageService.saveLocalPatient(patientToSave);

    // 4. Thử đồng bộ lên Firestore
    if (!db) {
      return { success: false, error: 'Chưa khởi tạo kết nối Firestore' };
    }

    try {
      const patientRef = doc(db, PATIENTS_COLLECTION, patientToSave.study_id);
      await setDoc(
        patientRef,
        {
          study_id: patientToSave.study_id,
          medical_record_number: patientToSave.medical_record_number ?? null,
          patient_name: patientToSave.patient_name ?? null,
          birth_year: patientToSave.birth_year ?? null,
          t0_timestamp: patientToSave.t0_timestamp ?? null,
          custom_timepoints: patientToSave.custom_timepoints ?? null,
          age: patientToSave.age ?? null,
          para: patientToSave.para ?? null,
          anesthesia_method: patientToSave.anesthesia_method ?? null,
          analgesia_drugs: patientToSave.analgesia_drugs ?? null,
          paper_vas_score: patientToSave.paper_vas_score ?? null,
          drug_administration_time: patientToSave.drug_administration_time ?? null,
          surgery_group: patientToSave.surgery_group ?? null,
          care_location: patientToSave.care_location ?? null,
          created_at: patientToSave.created_at,
          created_by: patientToSave.created_by,
          created_by_name: patientToSave.created_by_name,
          notes: patientToSave.notes ?? null,
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
   * Kiểm tra validation nghiêm ngặt, chống gửi trùng, hỗ trợ lưu offline an toàn
   */
  async saveAssessment(assessment: Assessment): Promise<{ success: boolean; save_status: SaveStatus; error?: string }> {
    // 0. Xác thực dữ liệu y tế trước khi lưu
    const validation = this.validateAssessment(assessment);
    if (!validation.valid) {
      return {
        success: false,
        save_status: 'failed',
        error: validation.error || 'Dữ liệu đánh giá không hợp lệ.',
      };
    }

    let finalSaveStatus: SaveStatus = 'offline_cached';
    let errorCode: string | null = null;

    // Chuẩn hóa điểm số eVAS nếu là số
    const normalizedScore =
      typeof assessment.eVAS_score === 'number'
        ? Number(assessment.eVAS_score.toFixed(1))
        : typeof assessment.vas_score === 'number'
        ? Number(assessment.vas_score.toFixed(1))
        : null;

    // Chuẩn hóa bối cảnh đau
    const normalizedContext =
      assessment.pain_context === 'van_dong' ? 'hoat_dong' : (assessment.pain_context || 'nghi');

    const patientCode = (assessment.patient_code || assessment.study_id).trim().toUpperCase();
    const recordId = assessment.record_id || assessment.assessment_id;
    const actualTime = assessment.actual_timestamp || assessment.submit_timestamp || new Date().toISOString();

    const assessmentToPersist: Assessment = {
      ...assessment,
      assessment_id: recordId,
      record_id: recordId,
      study_id: patientCode,
      patient_code: patientCode,
      episode_id: assessment.episode_id,
      selected_timepoint: assessment.selected_timepoint || assessment.timepoint_label || (assessment.assessment_timepoint as string) || null,
      assessment_order: assessment.assessment_order ?? 1,
      t0_timestamp: assessment.t0_timestamp || null,
      pain_context: normalizedContext,
      eVAS_score: normalizedScore,
      vas_score: normalizedScore,
      actual_timestamp: actualTime,
      submit_timestamp: actualTime,
      timezone: assessment.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
      elapsed_minutes_from_T0: assessment.elapsed_minutes_from_T0,
      timepoint_label: assessment.timepoint_label || (assessment.selected_timepoint as string) || (assessment.assessment_timepoint as string) || 'T1',
      planned_timepoint: assessment.planned_timepoint ?? (assessment.selected_timepoint as string) ?? (assessment.assessment_timepoint as string),
      timepoint_status: assessment.timepoint_status || (assessment.timepoint_label === 'T0' ? 'BASELINE' : 'ON_TIME'),
      is_early: assessment.is_early ?? false,
      activity_name: assessment.activity_name ?? null,
      activity_timing: assessment.activity_timing ?? null,
      surgery_group: assessment.surgery_group ?? null,
      care_location: assessment.care_location ?? null,
      reason_not_completed: assessment.reason_not_completed ?? null,
      technical_issue: assessment.technical_issue ?? null,
    };

    // 1. Thử ghi lên Firestore trước
    if (db) {
      try {
        const assessmentRef = doc(db, ASSESSMENTS_COLLECTION, assessmentToPersist.assessment_id);
        await setDoc(assessmentRef, {
          assessment_id: assessmentToPersist.assessment_id,
          record_id: assessmentToPersist.record_id,
          study_id: assessmentToPersist.study_id,
          patient_code: assessmentToPersist.patient_code,
          episode_id: assessmentToPersist.episode_id || null,
          selected_timepoint: assessmentToPersist.selected_timepoint || null,
          assessment_order: assessmentToPersist.assessment_order ?? 1,
          t0_timestamp: assessmentToPersist.t0_timestamp || null,
          assessment_timepoint: assessmentToPersist.assessment_timepoint,
          actual_timestamp: assessmentToPersist.actual_timestamp,
          timezone: assessmentToPersist.timezone,
          elapsed_minutes_from_T0: assessmentToPersist.elapsed_minutes_from_T0 ?? null,
          timepoint_label: assessmentToPersist.timepoint_label,
          planned_timepoint: assessmentToPersist.planned_timepoint,
          timepoint_status: assessmentToPersist.timepoint_status,
          is_early: assessmentToPersist.is_early,
          pain_context: assessmentToPersist.pain_context,
          activity_name: assessmentToPersist.activity_name,
          activity_timing: assessmentToPersist.activity_timing,
          surgery_group: assessmentToPersist.surgery_group,
          care_location: assessmentToPersist.care_location,
          eVAS_score: assessmentToPersist.eVAS_score,
          vas_score: assessmentToPersist.vas_score,
          start_timestamp: assessmentToPersist.start_timestamp,
          submit_timestamp: assessmentToPersist.submit_timestamp,
          duration_seconds: assessmentToPersist.duration_seconds,
          completion_status: assessmentToPersist.completion_status,
          reason_not_completed: assessmentToPersist.reason_not_completed,
          technical_issue: assessmentToPersist.technical_issue,
          assistance_status: assessmentToPersist.assistance_status,
          device_type: assessmentToPersist.device_type,
          app_version: assessmentToPersist.app_version,
          save_status: 'success',
          error_code: null,
          synced_at: serverTimestamp(),
        });
        finalSaveStatus = 'success';
      } catch (err: any) {
        console.warn('Firestore write failed, fallback to local storage:', err?.message);
        finalSaveStatus = 'offline_cached';
        errorCode = err?.message || 'Firestore_Connection_Error';
      }
    } else {
      errorCode = 'No_Firestore_Instance';
      finalSaveStatus = 'offline_cached';
    }

    // 2. Cập nhật trạng thái và lưu vào Local Cache (AsyncStorage)
    const localAssessmentRecord: Assessment = {
      ...assessmentToPersist,
      save_status: finalSaveStatus,
      error_code: errorCode,
    };
    await StorageService.saveLocalAssessment(localAssessmentRecord);

    return {
      success: true, // Lưu vào Firestore hoặc Local cache an toàn đều coi là thành công không mất dữ liệu
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
          const item = docSnapshot.data() as Assessment;
          list.push({
            ...item,
            pain_context: item.pain_context === 'van_dong' ? 'hoat_dong' : item.pain_context,
            activity_name: item.activity_name ?? null,
            activity_timing: item.activity_timing ?? null,
            surgery_group: item.surgery_group ?? null,
            care_location: item.care_location ?? null,
            reason_not_completed: item.reason_not_completed ?? null,
            technical_issue: item.technical_issue ?? null,
          });
        });
        await StorageService.clearAllLocalAssessments();
        for (const a of list) {
          await StorageService.saveLocalAssessment(a);
        }
        return list;
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
   * Xóa một bản ghi đánh giá điểm đau (cả Local và Firestore)
   */
  async deleteAssessment(
    assessmentId: string,
    _currentUser?: AppUser | null
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Luôn xóa trong bộ nhớ máy trước
    await StorageService.deleteLocalAssessment(assessmentId);

    // 2. Xóa trên Firestore nếu có kết nối
    if (db) {
      try {
        await deleteDoc(doc(db, ASSESSMENTS_COLLECTION, assessmentId));
      } catch (err: any) {
        console.warn('Lỗi xóa đánh giá trên Firestore (đã xóa local):', err?.message);
        return { success: true, error: 'Đã xóa trên máy, nhưng đồng bộ Firestore thất bại' };
      }
    }
    return { success: true };
  },

  /**
   * Xóa tất cả các lần đánh giá của một bệnh nhân
   */
  async deleteAssessmentsByPatient(
    studyId: string,
    _currentUser?: AppUser | null
  ): Promise<{ success: boolean; error?: string }> {
    const normalizedId = studyId.trim().toUpperCase();
    await StorageService.deleteLocalAssessmentsByPatient(normalizedId);

    if (db) {
      try {
        const q = query(collection(db, ASSESSMENTS_COLLECTION));
        const snap = await getDocs(q);
        const deletePromises: Promise<any>[] = [];
        snap.forEach((d) => {
          const item = d.data() as Assessment;
          if (item.study_id?.toUpperCase() === normalizedId) {
            deletePromises.push(deleteDoc(d.ref));
          }
        });
        await Promise.all(deletePromises);
      } catch (err: any) {
        console.warn('Lỗi xóa đánh giá theo bệnh nhân trên Firestore:', err?.message);
      }
    }
    return { success: true };
  },

  /**
   * Xóa tất cả các lần đánh giá trên toàn bộ hệ thống
   */
  async clearAllAssessments(
    _currentUser?: AppUser | null
  ): Promise<{ success: boolean; error?: string }> {
    await StorageService.clearAllLocalAssessments();

    if (db) {
      try {
        const q = query(collection(db, ASSESSMENTS_COLLECTION));
        const snap = await getDocs(q);
        const deletePromises: Promise<any>[] = [];
        snap.forEach((d) => {
          deletePromises.push(deleteDoc(d.ref));
        });
        await Promise.all(deletePromises);
      } catch (err: any) {
        console.warn('Lỗi xóa tất cả đánh giá trên Firestore:', err?.message);
      }
    }
    return { success: true };
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
   * Lấy danh sách hồ sơ bệnh nhân từ cơ sở dữ liệu
   * Phân quyền:
   * - Nếu là Admin hoặc chưa truyền user: Xem được toàn bộ hồ sơ
   * - Nếu là NCV: Chỉ xem được hồ sơ do chính mình tạo (patient.created_by === currentUser.id)
   */
  async getAllPatients(currentUser?: AppUser | null): Promise<Patient[]> {
    let allPatients: Patient[] = [];

    if (db) {
      try {
        const q = query(collection(db, PATIENTS_COLLECTION));
        const querySnapshot = await getDocs(q);
        const remotePatients: Patient[] = [];
        querySnapshot.forEach((docSnapshot) => {
          const p = docSnapshot.data() as Patient;
          if (p && p.study_id) {
            remotePatients.push(p);
          }
        });

        allPatients = remotePatients;
        // Cập nhật bộ nhớ đệm máy đồng bộ hoàn toàn với cơ sở dữ liệu
        await StorageService.saveAllLocalPatients(allPatients);
      } catch (err: any) {
        console.warn('Không thể load Patients từ Firestore, chuyển sang đọc bộ nhớ máy:', err?.message);
        allPatients = await StorageService.getLocalPatients();
      }
    } else {
      allPatients = await StorageService.getLocalPatients();
    }

    // Đảm bảo mọi bệnh nhân đều có thông tin người tạo (fallback)
    const normalizedList = allPatients.map((p) => {
      if (!p.created_by) {
        return {
          ...p,
          created_by: 'admin-01',
          created_by_name: 'Quản trị viên Đề tài',
        };
      }
      return p;
    });

    // Phân quyền theo người dùng
    if (currentUser) {
      if (currentUser.role === 'admin') {
        return normalizedList;
      }
      // NCV: Chỉ thấy bệnh nhân do chính mình tạo
      return normalizedList.filter((p) => p.created_by === currentUser.id);
    }

    return normalizedList;
  },

  /**
   * Xóa hồ sơ bệnh nhân khỏi hệ thống
   * Phân quyền: Chỉ người tạo hoặc Quản trị viên mới có quyền xóa
   */
  async deletePatient(
    studyId: string,
    currentUser?: AppUser | null,
    forceDelete: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    const normalizedId = studyId.trim().toUpperCase();
    const existing = await this.getPatient(normalizedId);
    if (!existing) {
      // Dọn dẹp trong local nếu hồ sơ không còn trên cloud
      await StorageService.deleteLocalPatient(normalizedId);
      return { success: true };
    }

    if (currentUser && !forceDelete) {
      const isAdmin = currentUser.role === 'admin';
      const isCreator = existing.created_by === currentUser.id;
      if (!isAdmin && existing.created_by && !isCreator) {
        return {
          success: false,
          error: 'Bạn không có quyền xóa hồ sơ này. Chỉ người tạo hoặc Quản trị viên mới được phép xóa.',
        };
      }
    }

    // 1. Xóa trong bộ nhớ máy
    await StorageService.deleteLocalPatient(normalizedId);

    // 2. Xóa trên Firestore
    if (db) {
      try {
        const ref = doc(db, PATIENTS_COLLECTION, normalizedId);
        await deleteDoc(ref);
      } catch (err: any) {
        console.warn('Lỗi xóa Patient trên Firestore (đã xóa local):', err?.message);
        return { success: false, error: err?.message };
      }
    }

    return { success: true };
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
      if (res.success && res.save_status === 'success') {
        synced++;
      } else {
        failed++;
      }
    }

    return { total: unsynced.length, synced, failed };
  },

  /**
   * Xuất dữ liệu sang định dạng CSV KHÔNG KÈM ĐỊNH DANH TRỰC TIẾP
   * Đảm bảo đúng chuẩn yêu cầu:
   * study_code, surgery_group, care_location, assessment_context, activity_name,
   * activity_timing, score_0_100, timestamp, self_or_assisted, completion_status,
   * reason_not_completed, technical_issue
   */
  exportToCSV(assessments: Assessment[], patients: Patient[] = []): string {
    const headers = [
      'medical_record_number',
      'birth_year',
      'selected_timepoint',
      'vas_score',
      'actual_timestamp',
      'elapsed_minutes_from_T0',
      'assessment_order',
      't0_timestamp',
      'patient_code',
      'episode_id',
      'record_id',
      'timezone',
      'timepoint_label',
      'planned_timepoint',
      'timepoint_status',
      'is_early',
      'save_status',
      'study_code',
      'timepoint',
      'surgery_group',
      'care_location',
      'assessment_context',
      'activity_group',
      'activity_name',
      'activity_execution_status',
      'score_0_100',
      'timestamp',
      'self_or_assisted',
      'completion_status',
      'reason_not_completed',
      'technical_issue',
    ];

    const escapeCsv = (str: string | number | boolean | null | undefined): string => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    // Tạo map để tra cứu thông tin bệnh nhân nhanh
    const patientMap = new Map<string, Patient>();
    patients.forEach((p) => {
      patientMap.set(p.study_id.toUpperCase(), p);
      if (p.medical_record_number) {
        patientMap.set(p.medical_record_number.toUpperCase(), p);
      }
    });

    const rows = assessments.map((a) => {
      const pCode = a.patient_code || a.study_id;
      const patient = patientMap.get(pCode.toUpperCase()) || patientMap.get(a.study_id.toUpperCase());
      const mrn = a.medical_record_number || patient?.medical_record_number || pCode;
      const birthYear = patient?.birth_year ?? (patient?.age ? (new Date().getFullYear() - patient.age) : '');
      const selectedTp = a.selected_timepoint || a.timepoint_label || (a.assessment_timepoint as string) || '';
      const order = a.assessment_order ?? 1;
      const t0Time = a.t0_timestamp || patient?.t0_timestamp || '';

      const recId = a.record_id || a.assessment_id;
      const epId = a.episode_id || '';
      const actTime = a.actual_timestamp || a.submit_timestamp;
      const tz = a.timezone || 'Asia/Ho_Chi_Minh';
      const elapsedMin = a.elapsed_minutes_from_T0 !== undefined ? a.elapsed_minutes_from_T0 : '';
      const tpLabel = a.timepoint_label || (a.assessment_timepoint as string) || '';
      const plannedTp = a.planned_timepoint || '';
      const tpStatus = a.timepoint_status || (tpLabel === 'T0' ? 'BASELINE' : 'ON_TIME');
      const isEarly = a.is_early ? 'TRUE' : 'FALSE';

      const scoreValue =
        typeof a.vas_score === 'number'
          ? a.vas_score.toFixed(1)
          : typeof a.eVAS_score === 'number'
          ? a.eVAS_score.toFixed(1)
          : '';

      const contextLabel =
        a.pain_context === 'nghi' ? 'Đau khi nghỉ' : 'Đau khi thực hiện hoạt động';

      const selfOrAssisted =
        a.assistance_status === 'self' ? 'Người bệnh tự thao tác' : 'Có nhân viên hỗ trợ';

      const completionStatusText =
        a.completion_status === 'completed'
          ? 'Hoàn thành'
          : a.completion_status === 'not_completed'
          ? 'Không thực hiện / Không áp dụng'
          : 'Đã hủy giữa chừng';

      const executionStatusText = a.activity_execution_status
        ? (EXECUTION_STATUS_LABELS[a.activity_execution_status] || a.activity_execution_status)
        : (a.pain_context === 'nghi' ? 'Nghỉ ngơi' : '');

      const reasonText = a.reason_not_completed
        ? (REASON_NOT_COMPLETED_LABELS[a.reason_not_completed as keyof typeof REASON_NOT_COMPLETED_LABELS] || a.reason_not_completed)
        : '';

      return [
        escapeCsv(mrn),
        escapeCsv(birthYear),
        escapeCsv(selectedTp),
        scoreValue !== '' ? scoreValue : '""',
        escapeCsv(actTime),
        escapeCsv(elapsedMin),
        escapeCsv(order),
        escapeCsv(t0Time),
        escapeCsv(pCode),
        escapeCsv(epId),
        escapeCsv(recId),
        escapeCsv(tz),
        escapeCsv(tpLabel),
        escapeCsv(plannedTp),
        escapeCsv(tpStatus),
        escapeCsv(isEarly),
        escapeCsv(a.save_status || 'offline_cached'),
        escapeCsv(a.study_id),
        escapeCsv(a.assessment_timepoint || tpLabel || 'T1'),
        escapeCsv(a.surgery_group || 'Chưa phân nhóm'),
        escapeCsv(a.care_location || 'Chưa ghi nhận'),
        escapeCsv(contextLabel),
        escapeCsv(a.activity_group || ''),
        escapeCsv(a.activity_name || ''),
        escapeCsv(executionStatusText),
        scoreValue !== '' ? scoreValue : '""',
        escapeCsv(a.submit_timestamp),
        escapeCsv(selfOrAssisted),
        escapeCsv(completionStatusText),
        escapeCsv(reasonText),
        escapeCsv(a.technical_issue || ''),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  },

  // ==========================================
  // --- QUẢN LÝ TÀI KHOẢN & MÃ PIN NCV TRÊN CSDL ---
  // ==========================================

  /**
   * Lấy danh sách tất cả tài khoản NCV & mã PIN từ Firestore (hoặc Local Cache fallback)
   */
  async getAllResearchers(): Promise<ResearcherAccount[]> {
    const localResearchers = await StorageService.getLocalResearchers();

    if (db) {
      try {
        const q = query(collection(db, RESEARCHERS_COLLECTION));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const remoteList: ResearcherAccount[] = [];
          querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data() as ResearcherAccount;
            if (data && data.id) {
              remoteList.push(data);
            }
          });

          if (remoteList.length > 0) {
            // Cập nhật lại local cache để đồng bộ
            await StorageService.saveAllLocalResearchers(remoteList);
            return remoteList;
          }
        } else {
          // Firestore đang trống (lần đầu setup CSDL) -> Khởi tạo tài khoản ban đầu lên Firestore
          for (const initUser of INITIAL_SEED_RESEARCHERS) {
            try {
              const ref = doc(db, RESEARCHERS_COLLECTION, initUser.id);
              await setDoc(ref, {
                ...initUser,
                synced_at: serverTimestamp(),
              });
            } catch (seedErr) {
              console.warn('Lỗi seed researcher lên Firestore:', seedErr);
            }
          }
          return INITIAL_SEED_RESEARCHERS;
        }
      } catch (err: any) {
        console.warn('Không thể đọc Researchers từ Firestore, chuyển sang bộ nhớ máy:', err?.message);
      }
    }

    return localResearchers;
  },

  /**
   * Lưu hoặc cập nhật tài khoản NCV & mã PIN vào CSDL (Firestore + Local)
   */
  async saveResearcher(researcher: ResearcherAccount): Promise<{ success: boolean; error?: string }> {
    // 1. Luôn lưu vào Local Cache trước
    await StorageService.saveLocalResearcher(researcher);

    // 2. Thử lưu lên Firestore
    if (db) {
      try {
        const ref = doc(db, RESEARCHERS_COLLECTION, researcher.id);
        await setDoc(
          ref,
          {
            id: researcher.id,
            email: researcher.email.trim().toLowerCase(),
            name: researcher.name.trim(),
            role: researcher.role,
            title: researcher.title || '',
            pin: researcher.pin.trim(),
            password: researcher.password || '',
            is_active: researcher.is_active !== false,
            created_at: researcher.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            synced_at: serverTimestamp(),
          },
          { merge: true }
        );
        return { success: true };
      } catch (err: any) {
        console.warn('Lỗi lưu Researcher lên Firestore (đã lưu local):', err?.message);
        return { success: false, error: err?.message || 'Lỗi mạng hoặc phân quyền Firestore' };
      }
    }

    return { success: true };
  },

  /**
   * Xóa tài khoản NCV khỏi CSDL (Firestore + Local)
   */
  async deleteResearcher(id: string): Promise<{ success: boolean; error?: string }> {
    // 1. Xóa trong Local Cache
    await StorageService.deleteLocalResearcher(id);

    // 2. Xóa trên Firestore
    if (db) {
      try {
        const ref = doc(db, RESEARCHERS_COLLECTION, id);
        await deleteDoc(ref);
        return { success: true };
      } catch (err: any) {
        console.warn('Lỗi xóa Researcher trên Firestore:', err?.message);
        return { success: false, error: err?.message };
      }
    }

    return { success: true };
  },

  /**
   * Tìm tài khoản theo Mã PIN trong CSDL
   */
  async getResearcherByPin(pin: string): Promise<ResearcherAccount | null> {
    const trimmed = pin.trim();
    if (!trimmed) return null;

    const all = await this.getAllResearchers();
    const found = all.find((r) => r.pin.trim() === trimmed && r.is_active !== false);
    return found || null;
  },

  /**
   * Tìm tài khoản theo Email trong CSDL
   */
  async getResearcherByEmail(email: string): Promise<ResearcherAccount | null> {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return null;

    const all = await this.getAllResearchers();
    const found = all.find((r) => r.email.trim().toLowerCase() === trimmed && r.is_active !== false);
    return found || null;
  },

  /**
   * Tiêu hủy hoàn toàn dữ liệu bệnh nhân và đánh giá trên CSDL (Firestore + Local)
   * Nhằm thực hiện cam kết bảo mật thông tin bệnh nhân sau khi xuất Excel
   */
  async clearAllPatientData(): Promise<{
    success: boolean;
    deletedPatients: number;
    deletedAssessments: number;
    error?: string;
  }> {
    // 1. Luôn xóa sạch bộ nhớ máy trước
    await StorageService.clearAllPatientData();

    let deletedPatients = 0;
    let deletedAssessments = 0;

    // 2. Xóa trên Firestore nếu có kết nối
    if (db) {
      try {
        // Xóa collection patients
        const pQuery = query(collection(db, PATIENTS_COLLECTION));
        const pSnap = await getDocs(pQuery);
        const pPromises: Promise<void>[] = [];
        pSnap.forEach((docSnap) => {
          pPromises.push(deleteDoc(docSnap.ref));
          deletedPatients++;
        });
        await Promise.all(pPromises);

        // Xóa collection assessments
        const aQuery = query(collection(db, ASSESSMENTS_COLLECTION));
        const aSnap = await getDocs(aQuery);
        const aPromises: Promise<void>[] = [];
        aSnap.forEach((docSnap) => {
          aPromises.push(deleteDoc(docSnap.ref));
          deletedAssessments++;
        });
        await Promise.all(aPromises);

        return { success: true, deletedPatients, deletedAssessments };
      } catch (err: any) {
        console.warn('Lỗi xóa dữ liệu trên Firestore (đã xóa bộ nhớ máy):', err?.message);
        return {
          success: false,
          deletedPatients,
          deletedAssessments,
          error: err?.message || 'Không thể xóa trên Firestore, đã xóa trong bộ nhớ máy.',
        };
      }
    }

    return { success: true, deletedPatients, deletedAssessments };
  },
};
