import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');

test('1. MeasurementScreen - 10cm scale, XÁC NHẬN button', () => {
  const measurementScreenPath = path.join(projectRoot, 'src', 'screens', 'MeasurementScreen.tsx');
  const code = fs.readFileSync(measurementScreenPath, 'utf8');
  assert.ok(code.includes('getCalibratedVASHeight'), 'VAS must use calibrated height for 10 cm (100 mm)');
  assert.match(code, /XÁC NHẬN/, 'Must have XÁC NHẬN button');
});

test('2. VAS Thresholds - 0 đến <4 là Đau nhẹ, >=4 đến <7 là Đau vừa, >=7 là Đau nặng', () => {
  const measurementCode = fs.readFileSync(path.join(projectRoot, 'src', 'screens', 'MeasurementScreen.tsx'), 'utf8');
  assert.match(measurementCode, /vasMm\s*<\s*40.*['"]Đau nhẹ['"]/, 'MeasurementScreen: 0 - <40 mm is Đau nhẹ');
  assert.match(measurementCode, /vasMm\s*<\s*70.*['"]Đau vừa['"]/, 'MeasurementScreen: 40 - <70 mm is Đau vừa');
  assert.match(measurementCode, /['"]Đau nặng['"]/, 'MeasurementScreen: >=70 mm is Đau nặng');

  const historyCode = fs.readFileSync(path.join(projectRoot, 'src', 'screens', 'PatientHistoryModal.tsx'), 'utf8');
  assert.match(historyCode, /score\s*<\s*40.*return\s*['"]Đau nhẹ['"]/, 'PatientHistoryModal: 0 - <40 is Đau nhẹ');
  assert.match(historyCode, /score\s*<\s*70.*return\s*['"]Đau vừa['"]/, 'PatientHistoryModal: 40 - <70 is Đau vừa');
  assert.match(historyCode, /return\s*['"]Đau nặng['"]/, 'PatientHistoryModal: >=70 is Đau nặng');

  const sliderCode = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'eVASSlider.tsx'), 'utf8');
  assert.match(sliderCode, /score\s*<\s*40.*['"]Đau nhẹ['"]/, 'eVASSlider: 0 - <40 is Đau nhẹ');
  assert.match(sliderCode, /score\s*<\s*70.*['"]Đau vừa['"]/, 'eVASSlider: 40 - <70 is Đau vừa');
  assert.match(sliderCode, /['"]Đau nặng['"]/, 'eVASSlider: >=70 is Đau nặng');
});

test('3. T0 Reference Timepoint Selection & Immediate VAS Assessment Flow', () => {
  const patientDetailCode = fs.readFileSync(path.join(projectRoot, 'src', 'screens', 'PatientDetailScreen.tsx'), 'utf8');
  assert.ok(patientDetailCode.includes('t0Year') && patientDetailCode.includes('t0Hour') && patientDetailCode.includes('t0Minute'), 'PatientDetailScreen must support customizable T0 year, hour, and minute');
  assert.ok(patientDetailCode.includes('XÁC NHẬN T0 & ĐÁNH GIÁ VAS NGAY'), 'Must have button to confirm T0 and start VAS immediately');
  assert.ok(patientDetailCode.includes("onStartAssessmentForTimepoint('T0')"), 'Must trigger VAS assessment for timepoint T0');
  assert.ok(patientDetailCode.includes('Đánh giá VAS mốc T0 ngay'), 't0Card must have button to evaluate VAS at T0');

  const appCode = fs.readFileSync(path.join(projectRoot, 'App.tsx'), 'utf8');
  assert.ok(appCode.includes("selectedTimepoint === 'T0'"), 'App.tsx must handle selectedTimepoint T0');
  assert.ok(appCode.includes("timepoint_status: selectedTimepoint === 'T0' ? 'BASELINE' : 'ON_TIME'"), 'T0 assessment must have BASELINE status');

  const storageCode = fs.readFileSync(path.join(projectRoot, 'src', 'services', 'storageService.ts'), 'utf8');
  assert.ok(storageCode.includes('updateActiveEpisodeT0'), 'StorageService must support updating active episode T0');
});

test('4. Security Commitment Agreement & Complete Patient Data Purging on Excel Export', () => {
  const summaryScreenCode = fs.readFileSync(path.join(projectRoot, 'src', 'screens', 'SummaryTableScreen.tsx'), 'utf8');
  assert.ok(summaryScreenCode.includes('isCommittedToWipe'), 'SummaryTableScreen must maintain commitment state');
  assert.ok(summaryScreenCode.includes('BẢNG CAM KẾT BẢO MẬT & BẢO VỆ DỮ LIỆU'), 'Must display commitment agreement header');
  assert.ok(summaryScreenCode.includes('không lưu trữ, không quản lý và không tiếp cận bất kỳ thông tin nào của bệnh nhân'), 'Must state app publisher does not manage or store patient data');
  assert.ok(summaryScreenCode.includes('handlePurgeData'), 'Must have handlePurgeData function to purge patient records');
  assert.ok(summaryScreenCode.includes('XÁC NHẬN & TẠO FILE EXCEL (.xlsx)'), 'Must confirm export with commitment check');
  assert.ok(summaryScreenCode.includes('purgedSuccessCard'), 'Must display confirmation banner when data is wiped');

  const storageCode = fs.readFileSync(path.join(projectRoot, 'src', 'services', 'storageService.ts'), 'utf8');
  assert.ok(storageCode.includes('clearAllPatientData'), 'StorageService must implement clearAllPatientData');

  const firebaseCode = fs.readFileSync(path.join(projectRoot, 'src', 'services', 'firebaseService.ts'), 'utf8');
  assert.ok(firebaseCode.includes('clearAllPatientData'), 'FirebaseService must implement clearAllPatientData');
});
