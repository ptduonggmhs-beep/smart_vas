import * as XLSX from 'xlsx';
import type { Patient, Assessment, TimepointConfigItem } from '../types/index.ts';

export interface ExcelExportOptions {
  includeNames?: boolean; // Cho phép kèm họ tên khi người dùng chủ động chọn
  filterScope?: 'all' | 'filtered' | 'selected';
  customFilename?: string;
}

export interface ExcelExportResult {
  success: boolean;
  filename: string;
  patientCount: number;
  assessmentCount: number;
  guidance?: string;
  error?: string;
}

export interface PreparedExcelFile {
  filename: string;
  patientCount: number;
  assessmentCount: number;
  byteSize: number;
  formattedSize: string;
  sheets: string[];
  file?: File;
  blob?: Blob;
  blobUrl?: string;
  localUri?: string;
  canShare: boolean;
}

/**
 * Định dạng tên file Excel theo chuẩn SmartVAS_YYYY-MM-DD_HHmm.xlsx từ thời gian thực tế
 * Ví dụ: SmartVAS_2026-10-28_1930.xlsx
 */
export function formatSmartVasExportFilename(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `SmartVAS_${yyyy}-${mm}-${dd}_${hh}${min}.xlsx`;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

async function getNativeFileSystem() {
  try {
    // @ts-ignore
    return await import('expo-file-system/legacy');
  } catch {
    return null;
  }
}

async function getNativeSharing() {
  try {
    // @ts-ignore
    return await import('expo-sharing');
  } catch {
    return null;
  }
}

export class ExcelExportService {
  /**
   * Tạo workbook Excel với đúng 3 Sheet theo Mục VIII:
   * - Sheet 1: TONG_HOP
   * - Sheet 2: CHI_TIET
   * - Sheet 3: HUONG_DAN_BIEN
   */
  static generateWorkbook(
    patients: Patient[],
    assessments: Assessment[],
    timepoints: TimepointConfigItem[],
    options: ExcelExportOptions = {}
  ): XLSX.WorkBook {
    const { includeNames = false } = options;

    // Nhóm đánh giá theo bệnh nhân và mốc
    const assessmentsByPatient: Record<string, Record<string, Assessment[]>> = {};

    assessments.forEach((a) => {
      const pKey = (a.patient_code || a.study_id).trim().toUpperCase();
      if (!assessmentsByPatient[pKey]) {
        assessmentsByPatient[pKey] = {};
      }
      const rawTp = (a.selected_timepoint || a.planned_timepoint || a.assessment_timepoint || a.timepoint_label || '').trim();
      const tpKey = rawTp.replace('h', '').toUpperCase();
      if (!assessmentsByPatient[pKey][tpKey]) {
        assessmentsByPatient[pKey][tpKey] = [];
      }
      assessmentsByPatient[pKey][tpKey].push(a);
    });

    // ========================================================
    // SHEET 1 — TONG_HOP
    // ========================================================
    const tongHopRows = patients.map((patient, index) => {
      const msba = (patient.medical_record_number || patient.study_id).trim().toUpperCase();
      const patientAssessments = assessmentsByPatient[msba] || {};

      const row: Record<string, any> = {
        STT: index + 1,
        study_id: patient.study_id,
        MSBA: msba,
      };

      // Chỉ xuất họ tên khi người dùng có quyền và chủ động chọn
      if (includeNames) {
        row['Ho_va_ten'] = patient.patient_name || (patient as any).full_name || '';
      }

      row['Nam_sinh'] = patient.birth_year ? Number(patient.birth_year) : '';
      row['episode_id'] = patient.study_id + '_EP1';
      row['T0_thuc_te'] = patient.t0_timestamp ? patient.t0_timestamp : '';

      // Duyệt qua tất cả các mốc (mặc định T1, T6, T12, T24 và các mốc tùy chỉnh)
      timepoints.forEach((tp) => {
        const normKey = tp.key.replace('h', '').toUpperCase();
        const list = patientAssessments[normKey] || [];

        if (list.length > 0) {
          // Ưu tiên bản ghi chính nếu có cờ is_primary_assessment
          const primary = list.find((item) => item.is_primary_assessment) || list[0];
          const rawScore = primary.vas_score ?? primary.eVAS_score;

          // Yêu cầu Mục VIII.2: Điểm VAS là kiểu dữ liệu số, không phải chuỗi có chữ "mm"
          row[`VAS_${tp.key}`] = rawScore !== null && rawScore !== undefined ? Number(rawScore.toFixed(1)) : '';
          row[`TIME_${tp.key}`] = primary.actual_timestamp || primary.submit_timestamp || '';
        } else {
          // Yêu cầu Mục VII.2 & VIII.2: Ô chưa đánh giá phải là ô trống thực sự, TUYỆT ĐỐI không điền 0
          row[`VAS_${tp.key}`] = '';
          row[`TIME_${tp.key}`] = '';
        }
      });

      return row;
    });

    const wsTongHop = XLSX.utils.json_to_sheet(tongHopRows);

    // ========================================================
    // SHEET 2 — CHI_TIET (Chỉ chứa các lượt đo của bệnh nhân được chọn)
    // ========================================================
    const targetPatientMsbaSet = new Set(
      patients.map((p) => (p.medical_record_number || p.study_id).trim().toUpperCase())
    );
    const targetPatientAssessments = assessments.filter((a) =>
      targetPatientMsbaSet.has((a.patient_code || a.study_id).trim().toUpperCase())
    );

    const chiTietRows = targetPatientAssessments.map((a) => {
      const rawScore = a.vas_score ?? a.eVAS_score;
      return {
        study_id: a.study_id || a.patient_code || '',
        episode_id: a.episode_id || (a.study_id ? a.study_id + '_EP1' : ''),
        assessment_id: a.assessment_id || a.record_id || '',
        selected_timepoint: a.selected_timepoint || a.planned_timepoint || a.assessment_timepoint || '',
        actual_timestamp: a.actual_timestamp || a.submit_timestamp || '',
        elapsed_minutes_from_T0: a.elapsed_minutes_from_T0 !== undefined ? a.elapsed_minutes_from_T0 : '',
        vas_score_mm: rawScore !== null && rawScore !== undefined ? Number(rawScore.toFixed(1)) : '',
        assessment_order: a.assessment_order || 1,
        is_primary_assessment: a.is_primary_assessment !== undefined ? Boolean(a.is_primary_assessment) : true,
      };
    });

    const wsChiTiet = XLSX.utils.json_to_sheet(chiTietRows);

    // ========================================================
    // SHEET 3 — HUONG_DAN_BIEN (Dictionary giải thích biến)
    // ========================================================
    const huongDanRows = [
      {
        Ten_bien: 'study_id',
        Y_nghia: 'Mã định danh bệnh nhân trong nghiên cứu (Subject ID)',
        Kieu_du_lieu: 'Chuỗi ký tự (String)',
        Ghi_chu: 'Khóa chính giả danh bảo mật danh tính người bệnh',
      },
      {
        Ten_bien: 'MSBA',
        Y_nghia: 'Mã số bệnh án tại cơ sở điều trị',
        Kieu_du_lieu: 'Chuỗi ký tự (String)',
        Ghi_chu: 'Dữ liệu y tế tại bệnh viện',
      },
      {
        Ten_bien: 'Ho_va_ten',
        Y_nghia: 'Họ và tên bệnh nhân (dữ liệu định danh)',
        Kieu_du_lieu: 'Chuỗi ký tự (String)',
        Ghi_chu: 'Chỉ xuất khi nhà nghiên cứu chủ động chọn xuất định danh',
      },
      {
        Ten_bien: 'Nam_sinh',
        Y_nghia: 'Năm sinh của người bệnh',
        Kieu_du_lieu: 'Số nguyên (Integer)',
        Ghi_chu: 'Dùng tính tuổi sinh học',
      },
      {
        Ten_bien: 'episode_id',
        Y_nghia: 'Mã đợt theo dõi điều trị sau mổ',
        Kieu_du_lieu: 'Chuỗi ký tự (String)',
        Ghi_chu: 'Định danh từng chu kỳ phẫu thuật - hậu phẫu',
      },
      {
        Ten_bien: 'T0_thuc_te',
        Y_nghia: 'Thời điểm tham chiếu T0 thực tế (khi kết thúc mổ hoặc đo đầu tiên)',
        Kieu_du_lieu: 'Ngày giờ (ISO DateTime)',
        Ghi_chu: 'Mốc 0 giờ tham chiếu để tính thời gian trôi qua',
      },
      {
        Ten_bien: 'VAS_T1, VAS_T6, VAS_T12, VAS_T24...',
        Y_nghia: 'Điểm đau trên thang VAS 10 cm tại các mốc T (đơn vị: mm)',
        Kieu_du_lieu: 'Số thực (Numeric, 0.0 - 100.0)',
        Ghi_chu: 'Ô trống biểu thị mốc chưa đánh giá; TUYỆT ĐỐI không phải 0 mm',
      },
      {
        Ten_bien: 'TIME_T1, TIME_T6, TIME_T12, TIME_T24...',
        Y_nghia: 'Thời điểm đo thực tế của mốc T tương ứng',
        Kieu_du_lieu: 'Ngày giờ (ISO DateTime)',
        Ghi_chu: 'Giữ nguyên thời gian đo thực tế, không tự làm tròn',
      },
      {
        Ten_bien: 'assessment_id',
        Y_nghia: 'Mã định danh duy nhất của lượt đánh giá VAS',
        Kieu_du_lieu: 'Chuỗi UUID (String)',
        Ghi_chu: 'Khóa chính bảo đảm không trùng lặp bản ghi',
      },
      {
        Ten_bien: 'selected_timepoint',
        Y_nghia: 'Mốc thời gian nghiên cứu do bác sĩ chỉ định',
        Kieu_du_lieu: 'Chuỗi ký tự (String: T1, T6, T12, T24...)',
        Ghi_chu: 'Độc lập với thời gian đo thực tế',
      },
      {
        Ten_bien: 'actual_timestamp',
        Y_nghia: 'Thời gian chính xác khi bệnh nhân bấm xác nhận điểm đau',
        Kieu_du_lieu: 'Ngày giờ (ISO DateTime)',
        Ghi_chu: 'Ghi nhận tự động từ đồng hồ hệ thống',
      },
      {
        Ten_bien: 'elapsed_minutes_from_T0',
        Y_nghia: 'Số phút thực tế đã trôi qua kể từ mốc T0 tham chiếu',
        Kieu_du_lieu: 'Số nguyên (Integer, phút)',
        Ghi_chu: 'Để trống nếu chưa có T0 tham chiếu',
      },
      {
        Ten_bien: 'is_primary_assessment',
        Y_nghia: 'Cờ xác định bản ghi chính thức của mốc đánh giá',
        Kieu_du_lieu: 'Logic (Boolean: TRUE/FALSE)',
        Ghi_chu: 'Dùng lọc bản ghi chính khi một mốc có nhiều lần đo',
      },
    ];

    const wsHuongDan = XLSX.utils.json_to_sheet(huongDanRows);

    // Ghép 3 sheet vào Workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, wsTongHop, 'TONG_HOP');
    XLSX.utils.book_append_sheet(workbook, wsChiTiet, 'CHI_TIET');
    XLSX.utils.book_append_sheet(workbook, wsHuongDan, 'HUONG_DAN_BIEN');

    return workbook;
  }

  /**
   * Bước 1: Chuẩn bị file Excel thật (.xlsx), tính dung lượng và kiểm tra cấu trúc 3 sheet
   */
  static async prepareExportFile(
    patients: Patient[],
    assessments: Assessment[],
    timepoints: TimepointConfigItem[],
    options: ExcelExportOptions = {}
  ): Promise<PreparedExcelFile> {
    if (!patients || patients.length === 0) {
      throw new Error('Không có bệnh nhân nào trong phạm vi xuất đã chọn.');
    }

    const filename = options.customFilename || formatSmartVasExportFilename();
    const wb = this.generateWorkbook(patients, assessments, timepoints, options);

    // Xác thực cấu trúc 3 sheet chuẩn theo Mục VIII
    const sheets = wb.SheetNames || [];
    if (!sheets.includes('TONG_HOP') || !sheets.includes('CHI_TIET') || !sheets.includes('HUONG_DAN_BIEN')) {
      throw new Error('Cấu trúc file Excel không đủ 3 Sheet chuẩn: TONG_HOP, CHI_TIET, HUONG_DAN_BIEN.');
    }

    // Đếm số lượng đánh giá thực tế của đúng các bệnh nhân được xuất
    const targetPatientMsbaSet = new Set(
      patients.map((p) => (p.medical_record_number || p.study_id).trim().toUpperCase())
    );
    const targetPatientAssessments = assessments.filter((a) =>
      targetPatientMsbaSet.has((a.patient_code || a.study_id).trim().toUpperCase())
    );

    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

    if (isBrowser) {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const byteSize = wbout?.byteLength || (wbout as any)?.length || 0;
      if (byteSize === 0) {
        throw new Error('File Excel được tạo có dung lượng rỗng (0 bytes).');
      }

      const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([wbout], { type: mimeType });
      const file = new File([blob], filename, { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      let canShare = false;
      if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
        try {
          canShare = navigator.canShare({ files: [file] });
        } catch {
          canShare = false;
        }
      }

      return {
        filename,
        patientCount: patients.length,
        assessmentCount: targetPatientAssessments.length,
        byteSize,
        formattedSize: formatBytes(byteSize),
        sheets,
        file,
        blob,
        blobUrl,
        canShare,
      };
    } else {
      // Native (Expo / iOS / Android)
      const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const byteSize = Math.round((base64.length * 3) / 4);

      let localUri = '';
      let canShare = false;

      const fsModule = await getNativeFileSystem();
      if (fsModule) {
        try {
          const cacheDir = fsModule.cacheDirectory || fsModule.documentDirectory || '';
          localUri = `${cacheDir}${filename}`;
          await fsModule.writeAsStringAsync(localUri, base64, {
            encoding: fsModule.EncodingType.Base64,
          });
        } catch (fsErr) {
          console.warn('Lỗi ghi file local qua FileSystem:', fsErr);
        }
      }

      const sharingModule = await getNativeSharing();
      if (sharingModule) {
        try {
          canShare = await sharingModule.isAvailableAsync();
        } catch {
          canShare = false;
        }
      }

      return {
        filename,
        patientCount: patients.length,
        assessmentCount: targetPatientAssessments.length,
        byteSize,
        formattedSize: formatBytes(byteSize),
        sheets,
        localUri,
        canShare,
      };
    }
  }

  /**
   * Bước 2: Kích hoạt bảng chia sẻ gốc của iPhone (iOS Share Sheet / Web Share API)
   * Phải được gọi trực tiếp từ sự kiện nhấn nút của người dùng để thỏa mãn User Activation
   */
  static async sharePreparedFile(prepared: PreparedExcelFile): Promise<{
    status: 'shared' | 'cancelled' | 'unsupported' | 'error';
    error?: string;
  }> {
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

    if (isBrowser) {
      if (!prepared.file || typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
        return {
          status: 'unsupported',
          error: 'Trình duyệt hiện tại không hỗ trợ Web Share API. Hãy sử dụng nút Tải file về máy.',
        };
      }

      try {
        await navigator.share({
          files: [prepared.file],
          title: prepared.filename,
          text: `Dữ liệu xuất Excel Smart-VAS (${prepared.patientCount} bệnh nhân)`,
        });
        return { status: 'shared' };
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return { status: 'cancelled' };
        }
        return {
          status: 'error',
          error: err?.message || 'Không thể mở bảng chia sẻ của thiết bị.',
        };
      }
    } else {
      // Native iOS / Android
      if (!prepared.localUri) {
        return { status: 'unsupported', error: 'Chưa có đường dẫn file nội bộ trên thiết bị.' };
      }

      const sharingModule = await getNativeSharing();
      if (!sharingModule) {
        return { status: 'unsupported', error: 'Module expo-sharing không khả dụng.' };
      }

      try {
        const available = await sharingModule.isAvailableAsync();
        if (!available) {
          return { status: 'unsupported', error: 'Thiết bị không hỗ trợ tính năng chia sẻ tệp.' };
        }

        await sharingModule.shareAsync(prepared.localUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: prepared.filename,
          UTI: 'com.microsoft.excel.xlsx',
        });
        return { status: 'shared' };
      } catch (err: any) {
        return {
          status: 'error',
          error: err?.message || 'Không thể mở bảng chia sẻ iOS.',
        };
      }
    }
  }

  /**
   * Phương án dự phòng: Tải file trực tiếp về thiết bị (Web)
   */
  static downloadPreparedFile(prepared: PreparedExcelFile): { success: boolean; error?: string } {
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

    if (isBrowser) {
      try {
        const link = document.createElement('a');
        link.href = prepared.blobUrl || (prepared.blob ? URL.createObjectURL(prepared.blob) : '');
        link.download = prepared.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Không thể tải file.' };
      }
    } else {
      return { success: false, error: 'Trên ứng dụng di động, hãy dùng tính năng Chia sẻ để Lưu vào Tệp.' };
    }
  }

  /**
   * Thu hồi Blob URL khi đóng modal hoặc hủy file để tránh rò rỉ bộ nhớ
   */
  static revokePreparedFile(prepared?: PreparedExcelFile | null): void {
    if (prepared?.blobUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(prepared.blobUrl);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Xuất file .xlsx tương thích ngược (Tự động chuẩn bị và mở chia sẻ/tải về)
   */
  static async exportToExcelFile(
    patients: Patient[],
    assessments: Assessment[],
    timepoints: TimepointConfigItem[],
    options: ExcelExportOptions = {}
  ): Promise<ExcelExportResult> {
    try {
      const prepared = await this.prepareExportFile(patients, assessments, timepoints, options);

      // Thử chia sẻ nếu được hỗ trợ, ngược lại tải về
      if (prepared.canShare) {
        const shareRes = await this.sharePreparedFile(prepared);
        if (shareRes.status === 'error') {
          this.downloadPreparedFile(prepared);
        }
      } else {
        this.downloadPreparedFile(prepared);
      }

      return {
        success: true,
        filename: prepared.filename,
        patientCount: prepared.patientCount,
        assessmentCount: prepared.assessmentCount,
        guidance: 'File Excel đã được tạo. Hãy chọn Lưu vào Tệp hoặc gửi qua Zalo.',
      };
    } catch (err: any) {
      console.error('Lỗi xuất file Excel:', err);
      return {
        success: false,
        filename: '',
        patientCount: 0,
        assessmentCount: 0,
        error: err?.message || 'Có lỗi xảy ra khi tạo file Excel.',
      };
    }
  }

  /**
   * Kiểm tra chất lượng dữ liệu trước khi xuất theo Mục VIII.4
   */
  static validateDataBeforeExport(
    patients: Patient[],
    assessments: Assessment[],
    timepoints: TimepointConfigItem[]
  ): {
    warnings: string[];
    patientsWithoutT0: number;
    multipleAssessmentTimepoints: number;
    unassessedTimepoints: number;
  } {
    const warnings: string[] = [];
    let patientsWithoutT0 = 0;
    let multipleAssessmentTimepoints = 0;
    let unassessedTimepoints = 0;

    // 1. Kiểm tra bệnh nhân chưa có T0
    patients.forEach((p) => {
      if (!p.t0_timestamp) {
        patientsWithoutT0++;
      }
    });
    if (patientsWithoutT0 > 0) {
      warnings.push(`${patientsWithoutT0} bệnh nhân chưa thiết lập thời điểm tham chiếu T0.`);
    }

    // 2. Nhóm đánh giá kiểm tra mốc có nhiều lần đo
    const patientTps: Record<string, Record<string, number>> = {};
    assessments.forEach((a) => {
      const p = (a.patient_code || a.study_id).trim().toUpperCase();
      const tp = (a.selected_timepoint || a.planned_timepoint || a.assessment_timepoint || a.timepoint_label || '').trim().replace('h', '').toUpperCase();
      if (!patientTps[p]) patientTps[p] = {};
      patientTps[p][tp] = (patientTps[p][tp] || 0) + 1;
    });

    Object.values(patientTps).forEach((tps) => {
      Object.values(tps).forEach((count) => {
        if (count > 1) {
          multipleAssessmentTimepoints++;
        }
      });
    });

    if (multipleAssessmentTimepoints > 0) {
      warnings.push(`Có ${multipleAssessmentTimepoints} mốc có nhiều lần đánh giá (bảng tổng hợp sẽ ưu tiên bản ghi chính).`);
    }

    return {
      warnings,
      patientsWithoutT0,
      multipleAssessmentTimepoints,
      unassessedTimepoints,
    };
  }
}
