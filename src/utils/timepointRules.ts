/**
 * Tiện ích tính toán quy tắc mốc thời gian T0, Tn và cửa sổ ±10 phút cho nghiên cứu đau sau mổ (eVAS)
 * Tuân thủ quy chuẩn đề cương:
 * - T0: Mốc thời gian thực tế của lần đánh giá đầu tiên được lưu thành công trong đợt theo dõi.
 * - Tn: Cách T0 danh nghĩa n * 60 phút.
 * - Cửa sổ Tn: [targetTime(Tn) - 10 phút, targetTime(Tn) + 10 phút] (hai đầu cửa sổ tính là hợp lệ).
 * - Sớm trước T1 (< 50 phút từ T0): Trạng thái EARLY, nhãn "T0 – đánh giá sớm trước T1".
 * - Ngoài cửa sổ: Trạng thái OUT_OF_WINDOW, nhãn "Ngoài cửa sổ thời gian".
 */

export type TimepointStatus = 'BASELINE' | 'ON_TIME' | 'EARLY' | 'OUT_OF_WINDOW';

export interface TimepointEvaluation {
  status: TimepointStatus;
  timepointLabel: string;
  plannedTimepoint: string | null;
  isEarly: boolean;
  elapsedMinutes: number; // Số phút thực tế trôi qua từ T0
  nominalTargetTime: Date | null;
  windowStart: Date | null;
  windowEnd: Date | null;
  isFirstAssessment: boolean;
  warningType: 'NONE' | 'EARLY_T1' | 'OUT_OF_WINDOW';
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

export interface WindowInfo {
  n: number;
  label: string;
  nominalTime: Date;
  windowStart: Date;
  windowEnd: Date;
}

/**
 * Định dạng giờ phút hiển thị HH:mm (24h)
 */
export function formatTimeHHmm(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '--:--';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Định dạng ngày giờ đầy đủ YYYY-MM-DD HH:mm:ss
 */
export function formatDateTime(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '---';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hours}:${minutes}:${seconds}`;
}

export const formatTimestamp = formatDateTime;

/**
 * Tính cửa sổ của mốc Tn (n >= 1) dựa trên T0
 */
export function getWindowForTn(t0Date: Date | string | number, n: number): WindowInfo {
  const t0Ms = new Date(t0Date).getTime();
  const targetMs = t0Ms + n * 60 * 60 * 1000;
  const startMs = targetMs - 10 * 60 * 1000;
  const endMs = targetMs + 10 * 60 * 1000;

  return {
    n,
    label: `T${n}`,
    nominalTime: new Date(targetMs),
    windowStart: new Date(startMs),
    windowEnd: new Date(endMs),
  };
}

/**
 * Đánh giá thời điểm đánh giá hiện tại so với T0
 * @param t0Timestamp ISO string hoặc timestamp T0 gốc (null nếu là lượt đầu tiên)
 * @param currentTimestamp Thời điểm đánh giá (mặc định là hiện tại)
 */
export function evaluateTimepoint(
  t0Timestamp: string | null | undefined,
  currentTimestamp: Date | string | number = new Date()
): TimepointEvaluation {
  const actualDate = new Date(currentTimestamp);
  const actualMs = actualDate.getTime();

  // 1. Trường hợp là lần đánh giá đầu tiên (chưa có T0 trong đợt theo dõi)
  if (!t0Timestamp) {
    return {
      status: 'BASELINE',
      timepointLabel: 'T0',
      plannedTimepoint: 'T0',
      isEarly: false,
      elapsedMinutes: 0,
      nominalTargetTime: actualDate,
      windowStart: actualDate,
      windowEnd: actualDate,
      isFirstAssessment: true,
      warningType: 'NONE',
      timepoint_status: 'BASELINE',
      timepoint_label: 'T0',
      planned_timepoint: 'T0',
      is_early: false,
      is_out_of_window: false,
      is_t0: true,
      elapsed_minutes_from_T0: 0,
      actual_timestamp: actualDate.toISOString(),
    };
  }

  const t0Date = new Date(t0Timestamp);
  const t0Ms = t0Date.getTime();
  // Tính chính xác số phút trôi qua từ T0 (không làm tròn trước khi so sánh)
  const elapsedMinutes = (actualMs - t0Ms) / 60000.0;

  // Cửa sổ T1 bắt đầu lúc T0 + 50 phút
  const t1Window = getWindowForTn(t0Ms, 1);

  // 2. Trường hợp đánh giá sớm trước T1 (elapsedMinutes < 50)
  if (actualMs < t1Window.windowStart.getTime()) {
    const minutesLeft = Math.max(1, Math.ceil((t1Window.windowStart.getTime() - actualMs) / 60000.0));
    return {
      status: 'EARLY',
      timepointLabel: 'T0 – đánh giá sớm trước T1',
      plannedTimepoint: 'T1',
      isEarly: true,
      elapsedMinutes: Math.round(elapsedMinutes * 10) / 10,
      nominalTargetTime: t1Window.nominalTime,
      windowStart: t1Window.windowStart,
      windowEnd: t1Window.windowEnd,
      isFirstAssessment: false,
      warningType: 'EARLY_T1',
      warningTitle: 'Chưa đến cửa sổ thời gian T1',
      warningMessage: `Chưa đến cửa sổ thời gian T1.\n\nT1 dự kiến từ ${formatTimeHHmm(
        t1Window.windowStart
      )} đến ${formatTimeHHmm(t1Window.windowEnd)}.\n\nThời gian hiện tại: ${formatTimeHHmm(
        actualDate
      )} — còn ${minutesLeft} phút mới đến cửa sổ T1.`,
      timepoint_status: 'EARLY',
      timepoint_label: 'T0 – đánh giá sớm trước T1',
      planned_timepoint: 'T1',
      is_early: true,
      is_out_of_window: true,
      is_t0: false,
      elapsed_minutes_from_T0: Math.round(elapsedMinutes * 10) / 10,
      actual_timestamp: actualDate.toISOString(),
    };
  }

  // 3. Kiểm tra xem có rơi vào cửa sổ hợp lệ của bất kỳ mốc Tn nào không (n = 1, 2, 3...)
  // Cửa sổ Tn: [n * 60 - 10, n * 60 + 10] phút
  // Cận dưới của Tn là: n * 60 - 10 => n = (elapsed + 10) / 60
  // Ta kiểm tra mốc n khả dĩ nhất
  const approxN = Math.round(elapsedMinutes / 60.0);
  const candidates = [Math.max(1, approxN - 1), Math.max(1, approxN), approxN + 1];

  for (const n of candidates) {
    const win = getWindowForTn(t0Ms, n);
    const startMs = win.windowStart.getTime();
    const endMs = win.windowEnd.getTime();

    // Hai đầu cửa sổ được tính là hợp lệ (inclusive)
    if (actualMs >= startMs && actualMs <= endMs) {
      return {
        status: 'ON_TIME',
        timepointLabel: `T${n}`,
        plannedTimepoint: `T${n}`,
        isEarly: false,
        elapsedMinutes: Math.round(elapsedMinutes * 10) / 10,
        nominalTargetTime: win.nominalTime,
        windowStart: win.windowStart,
        windowEnd: win.windowEnd,
        isFirstAssessment: false,
        warningType: 'NONE',
        timepoint_status: 'ON_TIME',
        timepoint_label: `T${n}`,
        planned_timepoint: `T${n}`,
        is_early: false,
        is_out_of_window: false,
        is_t0: false,
        elapsed_minutes_from_T0: Math.round(elapsedMinutes * 10) / 10,
        actual_timestamp: actualDate.toISOString(),
      };
    }
  }

  // 4. Trường hợp nằm ngoài cửa sổ (giữa 2 cửa sổ hoặc trễ sau cửa sổ)
  // Xác định mốc Tn vừa qua và mốc Tn tiếp theo để hiển thị thông tin cảnh báo rõ ràng
  let pastN = 1;
  while (getWindowForTn(t0Ms, pastN).windowEnd.getTime() < actualMs) {
    pastN++;
  }
  pastN = pastN - 1; // Mốc vừa kết thúc cửa sổ
  const nextN = pastN + 1; // Mốc sắp tới

  let windowInfoText = '';
  if (pastN >= 1) {
    const pastWin = getWindowForTn(t0Ms, pastN);
    const nextWin = getWindowForTn(t0Ms, nextN);
    windowInfoText = `Cửa sổ ${pastWin.label}: ${formatTimeHHmm(
      pastWin.windowStart
    )}–${formatTimeHHmm(pastWin.windowEnd)}.\nCửa sổ ${nextWin.label}: ${formatTimeHHmm(
      nextWin.windowStart
    )}–${formatTimeHHmm(nextWin.windowEnd)}.`;
  } else {
    const nextWin = getWindowForTn(t0Ms, 1);
    windowInfoText = `Cửa sổ T1: ${formatTimeHHmm(nextWin.windowStart)}–${formatTimeHHmm(
      nextWin.windowEnd
    )}.`;
  }

  return {
    status: 'OUT_OF_WINDOW',
    timepointLabel: 'Ngoài cửa sổ thời gian',
    plannedTimepoint: pastN >= 1 ? `T${pastN}` : 'T1',
    isEarly: false,
    elapsedMinutes: Math.round(elapsedMinutes * 10) / 10,
    nominalTargetTime: null,
    windowStart: null,
    windowEnd: null,
    isFirstAssessment: false,
    warningType: 'OUT_OF_WINDOW',
    warningTitle: 'Thời điểm hiện tại nằm ngoài cửa sổ đánh giá theo kế hoạch',
    warningMessage: `Thời điểm hiện tại nằm ngoài cửa sổ đánh giá theo kế hoạch.\n\n${windowInfoText}\n\nBạn có thể quay lại hoặc vẫn tiếp tục lưu kết quả ngoài cửa sổ.`,
    timepoint_status: 'OUT_OF_WINDOW',
    timepoint_label: 'Ngoài cửa sổ thời gian',
    planned_timepoint: pastN >= 1 ? `T${pastN}` : 'T1',
    is_early: false,
    is_out_of_window: true,
    is_t0: false,
    elapsed_minutes_from_T0: Math.round(elapsedMinutes * 10) / 10,
    actual_timestamp: actualDate.toISOString(),
  };
}
