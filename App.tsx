import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';

import {
  Assessment,
  AssessmentFlowStep,
  AssistanceStatus,
  DeviceType,
  PainContext,
  TimePoint,
  AppUser,
} from './src/types';
import { IdentificationScreen } from './src/screens/IdentificationScreen';
import { ContextScreen } from './src/screens/ContextScreen';
import { MeasurementScreen } from './src/screens/MeasurementScreen';
import { ConfirmationScreen } from './src/screens/ConfirmationScreen';
import { ResearcherModal } from './src/screens/ResearcherModal';
import { PatientHistoryModal } from './src/screens/PatientHistoryModal';
import { FirebaseService } from './src/services/firebaseService';
import { AuthService } from './src/services/authService';

export default function App() {
  const [currentStep, setCurrentStep] = useState<AssessmentFlowStep>('identify');
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

  // Current Assessment Session State
  const [studyId, setStudyId] = useState<string>('CS001');
  const [timepoint, setTimepoint] = useState<TimePoint>('T1');
  const [assistance, setAssistance] = useState<AssistanceStatus>('self');
  const [assessmentId, setAssessmentId] = useState<string>('');
  const [startTimestamp, setStartTimestamp] = useState<string>('');
  const [painContext, setPainContext] = useState<PainContext>('nghi');
  const [completedAssessment, setCompletedAssessment] = useState<Assessment | null>(null);

  // Màn hình 1: Nhận diện -> Bắt đầu phiên
  const handleStartIdentification = (
    selectedStudyId: string,
    selectedTimepoint: TimePoint,
    selectedAssistance: AssistanceStatus
  ) => {
    const newAssessmentId = Crypto.randomUUID();
    const now = new Date().toISOString();

    setStudyId(selectedStudyId);
    setTimepoint(selectedTimepoint);
    setAssistance(selectedAssistance);
    setAssessmentId(newAssessmentId);
    setStartTimestamp(now);
    setCurrentStep('context');
  };

  // Màn hình 2: Chọn bối cảnh đau
  const handleSelectContext = (context: PainContext) => {
    setPainContext(context);
    setCurrentStep('measure');
  };

  // Màn hình 3: Xác nhận điểm đau eVAS -> Lưu Firestore & Local
  const handleConfirmScore = async (score: number) => {
    setIsSubmitting(true);
    const submitTime = new Date().toISOString();
    const startTimeDate = new Date(startTimestamp).getTime();
    const submitTimeDate = new Date(submitTime).getTime();
    const durationSeconds = Math.max(1, Math.round((submitTimeDate - startTimeDate) / 1000));

    const deviceType: DeviceType =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

    const assessmentData: Assessment = {
      assessment_id: assessmentId,
      study_id: studyId,
      assessment_timepoint: timepoint,
      pain_context: painContext,
      eVAS_score: score,
      start_timestamp: startTimestamp,
      submit_timestamp: submitTime,
      duration_seconds: durationSeconds,
      completion_status: 'completed',
      assistance_status: assistance,
      device_type: deviceType,
      app_version: '1.0.0',
      save_status: 'offline_cached',
    };

    const saveResult = await FirebaseService.saveAssessment(assessmentData);
    setIsSubmitting(false);

    setCompletedAssessment({
      ...assessmentData,
      save_status: saveResult.save_status,
      error_code: saveResult.error || null,
    });
    setCurrentStep('confirm');
  };

  // Màn hình 4: Hoàn tất -> Tạo phiên mới
  const handleResetFlow = () => {
    setCurrentStep('identify');
    setCompletedAssessment(null);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="dark" />

        <View style={styles.contentContainer}>
          {currentStep === 'identify' && (
            <IdentificationScreen
              onStart={handleStartIdentification}
              onOpenResearcher={() => setIsResearcherOpen(true)}
              onOpenHistory={(id) => {
                setHistoryStudyId(id);
                setIsPatientHistoryOpen(true);
              }}
              currentUser={currentUser}
            />
          )}

          {currentStep === 'context' && (
            <ContextScreen
              studyId={studyId}
              onSelectContext={handleSelectContext}
              onBack={() => setCurrentStep('identify')}
            />
          )}

          {currentStep === 'measure' && (
            <MeasurementScreen
              studyId={studyId}
              painContext={painContext}
              onConfirmScore={handleConfirmScore}
              onBack={() => setCurrentStep('context')}
              isSubmitting={isSubmitting}
            />
          )}

          {currentStep === 'confirm' && completedAssessment && (
            <ConfirmationScreen
              assessment={completedAssessment}
              onReset={handleResetFlow}
              onOpenHistory={() => {
                setHistoryStudyId(completedAssessment.study_id);
                setIsPatientHistoryOpen(true);
              }}
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

        {/* Modal Lịch sử đánh giá của Sản phụ (Chỉ xem dữ liệu của chính mình) */}
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
