import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Platform, StatusBar as RNStatusBar, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';

import {
  Assessment,
  AssessmentFlowStep,
  DeviceType,
  TimePoint,
  Patient,
  AppUser,
} from './src/types';
import { WelcomeModeScreen } from './src/screens/WelcomeModeScreen';
import { PatientListScreen } from './src/screens/PatientListScreen';
import { PatientDetailScreen } from './src/screens/PatientDetailScreen';
import { MeasurementScreen } from './src/screens/MeasurementScreen';
import { SummaryTableScreen } from './src/screens/SummaryTableScreen';
import { ResearcherModal } from './src/screens/ResearcherModal';
import { PatientHistoryModal } from './src/screens/PatientHistoryModal';
import { FirebaseService } from './src/services/firebaseService';
import { StorageService } from './src/services/storageService';
import { AuthService } from './src/services/authService';

export default function App() {
  // Navigation step: default is 'welcome'
  const [currentStep, setCurrentStep] = useState<AssessmentFlowStep>('welcome');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedTimepoint, setSelectedTimepoint] = useState<string>('T1');

  // Modals & Users
  const [isResearcherOpen, setIsResearcherOpen] = useState<boolean>(false);
  const [isPatientHistoryOpen, setIsPatientHistoryOpen] = useState<boolean>(false);
  const [historyStudyId, setHistoryStudyId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  // Load existing researcher session on startup if previously logged in
  useEffect(() => {
    AuthService.getCurrentUser().then((user) => {
      if (user) setCurrentUser(user);
    });
  }, []);

  // Xác nhận điểm đau VAS trong chế độ Theo dõi đau bệnh nhân
  const handleConfirmPatientVAS = async (score: number) => {
    if (isSubmitting || !selectedPatient) return;
    setIsSubmitting(true);

    try {
      const now = new Date();
      const actualTime = now.toISOString();
      const patientCode = (selectedPatient.medical_record_number || selectedPatient.study_id).trim().toUpperCase();
      const recordId = Crypto.randomUUID();
      const roundScore = Number(score.toFixed(1));

      // Lấy lịch sử đánh giá để tính số thứ tự bản ghi (assessment_order) cho mốc này
      const existingAssessments = await FirebaseService.getAssessmentsByPatient(patientCode);
      const timepointAssessments = existingAssessments.filter(
        (a) =>
          (a.selected_timepoint || a.planned_timepoint || a.assessment_timepoint || a.timepoint_label || '')
            .trim()
            .replace('h', '')
            .toUpperCase() === selectedTimepoint.replace('h', '').toUpperCase()
      );
      const assessmentOrder = timepointAssessments.length + 1;

      // Xử lý mốc thời gian tham chiếu T0
      let t0Timestamp = selectedPatient.t0_timestamp || null;
      let elapsedMinutes: number | undefined = undefined;

      if (selectedTimepoint === 'T0') {
        elapsedMinutes = 0;
        if (!t0Timestamp) {
          t0Timestamp = actualTime;
          const updatedPatient: Patient = {
            ...selectedPatient,
            t0_timestamp: actualTime,
          };
          await FirebaseService.savePatient(updatedPatient, currentUser);
          setSelectedPatient(updatedPatient);
          await StorageService.updateActiveEpisodeT0(patientCode, actualTime);
        }
      } else if (t0Timestamp) {
        const t0Time = new Date(t0Timestamp).getTime();
        elapsedMinutes = Math.max(0, Math.round((now.getTime() - t0Time) / 60000));
      } else {
        // Phần 5.3: Nếu chưa có T0 và đây là lần đánh giá thành công đầu tiên, thiết lập T0 từ lượt này
        if (existingAssessments.length === 0) {
          t0Timestamp = actualTime;
          elapsedMinutes = 0;
          const updatedPatient: Patient = {
            ...selectedPatient,
            t0_timestamp: actualTime,
          };
          await FirebaseService.savePatient(updatedPatient, currentUser);
          setSelectedPatient(updatedPatient);
          await StorageService.updateActiveEpisodeT0(patientCode, actualTime);
        }
      }

      // Quản lý episode_id
      let episodeId = '';
      const activeEp = await StorageService.getActiveEpisode(patientCode);
      if (activeEp) {
        episodeId = activeEp.episode_id;
      } else {
        const newEp = await StorageService.createEpisode(patientCode, t0Timestamp || actualTime);
        episodeId = newEp.episode_id;
      }

      const deviceType: DeviceType =
        Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

      const assessmentData: Assessment = {
        assessment_id: recordId,
        record_id: recordId,
        study_id: patientCode,
        patient_code: patientCode,
        episode_id: episodeId,
        selected_timepoint: selectedTimepoint,
        assessment_timepoint: selectedTimepoint as TimePoint,
        assessment_order: assessmentOrder,
        t0_timestamp: t0Timestamp,
        pain_context: 'nghi',
        eVAS_score: roundScore,
        vas_score: roundScore,
        start_timestamp: actualTime,
        actual_timestamp: actualTime,
        submit_timestamp: actualTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
        elapsed_minutes_from_T0: elapsedMinutes,
        timepoint_label: selectedTimepoint,
        timepoint_status: selectedTimepoint === 'T0' ? 'BASELINE' : 'ON_TIME',
        is_early: false,
        duration_seconds: 5,
        completion_status: 'completed',
        reason_not_completed: null,
        technical_issue: null,
        assistance_status: 'self',
        device_type: deviceType,
        app_version: '2.5.0',
        save_status: 'offline_cached',
        is_primary_assessment: true,
      };

      const saveResult = await FirebaseService.saveAssessment(assessmentData);
      setIsSubmitting(false);

      if (saveResult.success) {
        setCurrentStep('patient_detail');
        return { success: true };
      } else {
        return { success: false, error: saveResult.error || 'Không thể lưu kết quả đánh giá.' };
      }
    } catch (err: any) {
      setIsSubmitting(false);
      return { success: false, error: err?.message || 'Có lỗi xảy ra khi lưu đánh giá.' };
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="dark" />

        <View style={styles.contentContainer}>
          {/* PHẦN 1: MÀN HÌNH CHỜ VỚI HAI CHẾ ĐỘ */}
          {currentStep === 'welcome' && (
            <WelcomeModeScreen
              onSelectQuickSurvey={() => setCurrentStep('quick_vas')}
              onSelectPatientTracking={() => setCurrentStep('patient_list')}
              onOpenResearcher={() => setIsResearcherOpen(true)}
              currentUser={currentUser}
            />
          )}

          {/* PHẦN 2: CHẾ ĐỘ KHẢO SÁT VAS NHANH (KHÔNG LƯU DỮ LIỆU) */}
          {currentStep === 'quick_vas' && (
            <MeasurementScreen
              isQuickSurvey={true}
              onBack={() => setCurrentStep('welcome')}
            />
          )}

          {/* PHẦN 3: CHẾ ĐỘ THEO DÕI ĐAU BỆNH NHÂN - DANH SÁCH BỆNH NHÂN */}
          {currentStep === 'patient_list' && (
            <PatientListScreen
              onSelectPatient={(patient) => {
                setSelectedPatient(patient);
                setCurrentStep('patient_detail');
              }}
              onBackToHome={() => setCurrentStep('welcome')}
              onOpenSummaryTable={() => setCurrentStep('summary_table')}
              currentUser={currentUser}
            />
          )}

          {/* PHẦN 7: BẢNG TỔNG HỢP TẤT CẢ BỆNH NHÂN (MỤC VII & VIII) */}
          {currentStep === 'summary_table' && (
            <SummaryTableScreen
              onBack={() => setCurrentStep('patient_list')}
              currentUser={currentUser}
              onSelectPatient={(patient) => {
                setSelectedPatient(patient);
                setCurrentStep('patient_detail');
              }}
            />
          )}

          {/* PHẦN 4 & 5: MÀN HÌNH CHI TIẾT BỆNH NHÂN & QUẢN LÝ CÁC MỐC T */}
          {currentStep === 'patient_detail' && selectedPatient && (
            <PatientDetailScreen
              patient={selectedPatient}
              onBack={() => {
                setSelectedPatient(null);
                setCurrentStep('patient_list');
              }}
              onStartAssessmentForTimepoint={(timepointKey) => {
                setSelectedTimepoint(timepointKey);
                setCurrentStep('patient_vas');
              }}
              currentUser={currentUser}
              onPatientUpdated={(updated) => setSelectedPatient(updated)}
            />
          )}

          {/* PHẦN 6: ĐÁNH GIÁ VAS THEO DÕI BỆNH NHÂN (LƯU VÀO MỐC ĐÃ CHỌN) */}
          {currentStep === 'patient_vas' && selectedPatient && (
            <MeasurementScreen
              studyId={selectedPatient.medical_record_number || selectedPatient.study_id}
              patientName={selectedPatient.patient_name || ''}
              selectedTimepoint={selectedTimepoint}
              isQuickSurvey={false}
              onConfirmScore={handleConfirmPatientVAS}
              onBack={() => setCurrentStep('patient_detail')}
              isSubmitting={isSubmitting}
            />
          )}
        </View>

        {/* Modal Nghiên cứu viên / Quản trị dữ liệu & Firebase */}
        <ResearcherModal
          visible={isResearcherOpen}
          onClose={() => setIsResearcherOpen(false)}
          currentUser={currentUser}
          onUserChanged={setCurrentUser}
        />

        {/* Modal Lịch sử đánh giá của Người bệnh */}
        <PatientHistoryModal
          visible={isPatientHistoryOpen}
          onClose={() => setIsPatientHistoryOpen(false)}
          studyId={historyStudyId}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  contentContainer: {
    flex: 1,
  },
});
