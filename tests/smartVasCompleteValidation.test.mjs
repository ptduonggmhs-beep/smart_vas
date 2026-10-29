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
