/**
 * Cấu hình tập trung các mốc thời gian theo dõi đau sau mổ (T1, T6, T12, T24)
 * Cho phép chỉnh sửa hoặc mở rộng cấu hình mốc trong mã nguồn một cách dễ dàng
 */

export interface TimepointConfigItem {
  key: string;
  label: string;
  description: string;
  nominalHours?: number;
}

export const DEFAULT_CLINICAL_TIMEPOINTS: TimepointConfigItem[] = [
  {
    key: 'T1',
    label: 'T1',
    description: 'Sau 1 giờ',
    nominalHours: 1,
  },
  {
    key: 'T6',
    label: 'T6',
    description: 'Sau 6 giờ',
    nominalHours: 6,
  },
  {
    key: 'T12',
    label: 'T12',
    description: 'Sau 12 giờ',
    nominalHours: 12,
  },
  {
    key: 'T24',
    label: 'T24',
    description: 'Sau 24 giờ',
    nominalHours: 24,
  },
];

export const CLINICAL_TIMEPOINTS = DEFAULT_CLINICAL_TIMEPOINTS;

export const PRESET_TIMEPOINT_PROTOCOLS: { name: string; items: TimepointConfigItem[] }[] = [
  {
    name: 'Quy chuẩn 4 mốc (T1, T6, T12, T24)',
    items: DEFAULT_CLINICAL_TIMEPOINTS,
  },
  {
    name: 'Phác đồ Hồi sức PACU (T0, T1, T2, T4, T6, T12, T24, T48)',
    items: [
      { key: 'T0', label: 'T0', description: 'Thời điểm ban đầu / Rời phòng mổ', nominalHours: 0 },
      { key: 'T1', label: 'T1', description: 'Sau 1 giờ', nominalHours: 1 },
      { key: 'T2', label: 'T2', description: 'Sau 2 giờ', nominalHours: 2 },
      { key: 'T4', label: 'T4', description: 'Sau 4 giờ', nominalHours: 4 },
      { key: 'T6', label: 'T6', description: 'Sau 6 giờ', nominalHours: 6 },
      { key: 'T12', label: 'T12', description: 'Sau 12 giờ', nominalHours: 12 },
      { key: 'T24', label: 'T24', description: 'Sau 24 giờ', nominalHours: 24 },
      { key: 'T48', label: 'T48', description: 'Sau 48 giờ', nominalHours: 48 },
    ],
  },
  {
    name: 'Phác đồ kéo dài (T1, T6, T12, T24, T48, T72)',
    items: [
      { key: 'T1', label: 'T1', description: 'Sau 1 giờ', nominalHours: 1 },
      { key: 'T6', label: 'T6', description: 'Sau 6 giờ', nominalHours: 6 },
      { key: 'T12', label: 'T12', description: 'Sau 12 giờ', nominalHours: 12 },
      { key: 'T24', label: 'T24', description: 'Sau 24 giờ', nominalHours: 24 },
      { key: 'T48', label: 'T48', description: 'Sau 48 giờ', nominalHours: 48 },
      { key: 'T72', label: 'T72', description: 'Sau 72 giờ', nominalHours: 72 },
    ],
  },
  {
    name: 'Phác đồ rút gọn (T6, T24)',
    items: [
      { key: 'T6', label: 'T6', description: 'Sau 6 giờ', nominalHours: 6 },
      { key: 'T24', label: 'T24', description: 'Sau 24 giờ', nominalHours: 24 },
    ],
  },
];

export function getTimepointConfig(key: string, customList: TimepointConfigItem[] = CLINICAL_TIMEPOINTS): TimepointConfigItem | undefined {
  return customList.find((tp) => tp.key.toUpperCase() === key.toUpperCase());
}
