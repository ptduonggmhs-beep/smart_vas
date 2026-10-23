import { Dimensions, PixelRatio, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const VAS_CLINICAL_LENGTH_MM = 100; // Chuẩn lâm sàng 10 cm = 100 mm
export const REFERENCE_CARD_LENGTH_MM = 85.6; // Chuẩn thẻ CCCD / ATM Quốc tế (ISO/IEC 7810 ID-1)
export const CALIBRATION_STORAGE_KEY = '@smart_vas_scale_calibration_factor';

/**
 * Tính số điểm ảnh logic (pt trên iOS, dp trên Android, px trên Web) tương ứng với 1mm vật lý
 */
export const getBasePointsPerMm = (): number => {
  const { width, height } = Dimensions.get('screen');
  const scale = PixelRatio.get();

  if (Platform.OS === 'ios') {
    const isTablet = Platform.isPad || Math.min(width, height) >= 600;
    if (isTablet) {
      // iPad Retina tiêu chuẩn: 264 ppi / 2 = 132 pt/inch
      const pointsPerInch = 132.0;
      return pointsPerInch / 25.4; // ~5.1968 pt/mm
    }

    if (scale >= 3) {
      // Tất cả dòng iPhone Super Retina OLED (iPhone X, XS, 11 Pro, 12, 13, 14, 15, 16 Pro/Plus/Max):
      // Độ phân giải thực 460 ppi. Tỉ lệ scale 3x => 460 / 3 = 153.333 pt/inch
      const pointsPerInch = 460.0 / 3.0; // 153.333 pt/inch
      return pointsPerInch / 25.4; // ~6.0367 pt/mm => 100mm = 603.67 pt
    }

    // Các dòng iPhone Retina LCD (iPhone SE 2/3, iPhone 7, 8, 11, XR):
    // Độ phân giải thực 326 ppi. Tỉ lệ scale 2x => 326 / 2 = 163 pt/inch
    const pointsPerInch = 163.0;
    return pointsPerInch / 25.4; // ~6.4173 pt/mm => 100mm = 641.73 pt
  }

  if (Platform.OS === 'android') {
    // Theo định chuẩn chính thức của Google Android DisplayMetrics:
    // 1 dp = 1 physical pixel trên màn hình 160 dpi.
    // 160 dp = 1 inch = 25.4 mm (bất kể màn hình mật độ mdpi, hdpi, xhdpi, xxhdpi, hay xxxhdpi).
    const dpPerInch = 160.0;
    return dpPerInch / 25.4; // ~6.2992 dp/mm => 100mm = 629.92 dp
  }

  // Trên môi trường Web / Trình duyệt Desktop hoặc Web Mobile
  if (Platform.OS === 'web') {
    const isMobileWeb =
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

    if (isMobileWeb) {
      const isAppleMobile =
        typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
      if (isAppleMobile) {
        return (scale >= 3 ? 460 / 3 : 163) / 25.4;
      }
      return 160.0 / 25.4;
    }

    // Desktop browser chuẩn W3C CSS: 96 CSS px = 1 inch
    return 96.0 / 25.4; // ~3.7795 px/mm => 100mm = 377.95 px
  }

  // Mặc định an toàn
  return 160.0 / 25.4;
};

/**
 * Lấy hệ số hiệu chuẩn đã lưu từ bộ nhớ máy (mặc định = 1.0)
 */
export const getStoredCalibrationFactor = async (): Promise<number> => {
  try {
    const val = await AsyncStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (val) {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed >= 0.7 && parsed <= 1.3) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Lỗi đọc hệ số hiệu chuẩn thước đo:', e);
  }
  return 1.0;
};

/**
 * Lưu hệ số hiệu chuẩn do NCV/Bác sĩ cân chỉnh bằng thước thực tế
 */
export const saveCalibrationFactor = async (factor: number): Promise<void> => {
  try {
    const clamped = Math.max(0.7, Math.min(1.3, factor));
    await AsyncStorage.setItem(CALIBRATION_STORAGE_KEY, clamped.toFixed(4));
  } catch (e) {
    console.error('Lỗi lưu hệ số hiệu chuẩn thước đo:', e);
  }
};

/**
 * Xóa hệ số hiệu chuẩn để khôi phục về tính toán mặc định theo nhà sản xuất
 */
export const resetCalibrationFactor = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CALIBRATION_STORAGE_KEY);
  } catch (e) {
    console.error('Lỗi xóa hiệu chuẩn thước đo:', e);
  }
};

/**
 * Tính chiều cao chính xác của thanh đo VAS 10cm (100mm) sau khi áp dụng hệ số hiệu chuẩn
 */
export const getCalibratedVASHeight = (calibrationFactor: number = 1.0): number => {
  const basePointsPerMm = getBasePointsPerMm();
  const rawHeight = basePointsPerMm * VAS_CLINICAL_LENGTH_MM;
  return Math.round(rawHeight * calibrationFactor * 10) / 10;
};

/**
 * Quy đổi chiều dài vật lý (mm) sang điểm ảnh (pt/dp)
 */
export const mmToPixels = (mm: number, calibrationFactor: number = 1.0): number => {
  const base = getBasePointsPerMm();
  return Math.round(base * mm * calibrationFactor * 10) / 10;
};

/**
 * Quy đổi điểm ảnh (pt/dp) sang chiều dài thực tế (mm)
 */
export const pixelsToMm = (pixels: number, calibrationFactor: number = 1.0): number => {
  const base = getBasePointsPerMm() * calibrationFactor;
  if (base <= 0) return 0;
  return Math.round((pixels / base) * 10) / 10;
};

/**
 * Trả về thông số chi tiết của màn hình hiện tại phục vụ đối chiếu và kiểm định lâm sàng
 */
export const getDisplayDiagnostics = (calibrationFactor: number = 1.0) => {
  const { width, height } = Dimensions.get('screen');
  const scale = PixelRatio.get();
  const fontScale = PixelRatio.getFontScale();
  const baseRate = getBasePointsPerMm();
  const finalHeight = getCalibratedVASHeight(calibrationFactor);

  return {
    os: Platform.OS,
    screenWidth: Math.round(width),
    screenHeight: Math.round(height),
    pixelRatio: scale,
    fontScale,
    basePointsPerMm: Math.round(baseRate * 1000) / 1000,
    calculatedHeight100mm: Math.round(baseRate * VAS_CLINICAL_LENGTH_MM * 10) / 10,
    calibrationFactor,
    finalCalibratedHeight: finalHeight,
    theoreticalDpi: Math.round(baseRate * 25.4 * (Platform.OS === 'ios' ? scale : 1)),
  };
};
