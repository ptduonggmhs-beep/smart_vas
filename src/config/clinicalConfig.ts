import { ClinicalConfig, ReasonNotCompleted, ActivityExecutionStatus, ClinicalActivityGroupItem } from '../types';

/**
 * TUYÊN BỐ AN TOÀN VÀ NGUYÊN TẮC Y TẾ:
 * Đây là công cụ ghi nhận, KHÔNG tự đưa ra chẩn đoán, chỉ định thuốc hoặc thay đổi điều trị.
 * Các danh mục hoạt động và thiết lập dưới đây được cấu hình theo quy trình cải tiến chất lượng
 * và phải được xem là cấu hình chờ nhân viên y tế / hội đồng lâm sàng của bệnh viện xác nhận.
 * Không tự động cho rằng mọi hoạt động an toàn cho mọi loại phẫu thuật.
 */

export const CLINICAL_DEFINITIONS = {
  TITLE_STEP_2: 'BẠN MUỐN ĐÁNH GIÁ ĐAU TRONG TÌNH HUỐNG NÀO?',

  RESTING_LABEL: 'ĐAU KHI NGHỈ',
  RESTING_DEFINITION:
    'Đánh giá mức độ đau hiện tại khi Anh/Chị đang nghỉ ở tư thế thoải mái, không chủ động thực hiện một hoạt động nhằm gây ra hoặc làm tăng đau tại vùng phẫu thuật.',
  RESTING_QUESTION: 'Hiện tại, khi đang nghỉ ở tư thế thoải mái, Anh/Chị đau ở mức độ nào?',

  ACTIVITY_LABEL: 'ĐAU KHI THỰC HIỆN HOẠT ĐỘNG',
  ACTIVITY_DEFINITION:
    'Đánh giá mức độ đau cao nhất mà Anh/Chị cảm nhận trong một hoạt động cụ thể đã được nhân viên y tế cho phép và phù hợp với loại phẫu thuật.',
  ACTIVITY_QUESTION: (activityName?: string) =>
    activityName
      ? `Trong lúc thực hiện ${activityName}, mức độ đau cao nhất Anh/Chị cảm nhận là bao nhiêu?`
      : 'Trong lúc thực hiện hoạt động, mức độ đau cao nhất Anh/Chị cảm nhận là bao nhiêu?',

  TOUCH_SCREEN_DISCLAIMER:
    'Lưu ý: Việc người bệnh chạm màn hình hoặc di chuyển ngón tay để chọn điểm VAS không được coi là hoạt động gây đau sau phẫu thuật.',

  SAFETY_ADVISORY:
    'Nếu Anh/Chị cảm thấy đau nhiều hoặc khó chịu, vui lòng bấm chuông gọi nhân viên y tế hoặc thông báo cho điều dưỡng/bác sĩ phụ trách ngay lập tức.',

  CLINICAL_DISCLAIMER:
    'Hệ thống là công cụ ghi nhận số liệu lâm sàng, KHÔNG thay thế chỉ định y khoa và KHÔNG tự động khuyến cáo thuốc.',
};

export const EXECUTION_STATUS_LABELS: Record<ActivityExecutionStatus, string> = {
  da_thuc_hien: 'Đã thực hiện hoạt động',
  chua_thuc_hien: 'Chưa thực hiện hoạt động',
  khong_duoc_phep: 'Không được phép thực hiện hoạt động theo kế hoạch hiện tại',
  khong_the_hoan_thanh: 'Đã thực hiện nhưng không thể hoàn thành đánh giá',
};

export const REASON_NOT_COMPLETED_LABELS: Record<ReasonNotCompleted, string> = {
  chua_duoc_cho_phep: 'Chưa được phép thực hiện theo kế hoạch hiện tại',
  khong_phu_hop_lam_sang: 'Không phù hợp về lâm sàng',
  khong_the_thuc_hien: 'Người bệnh không thể thực hiện / không thể thao tác',
  tu_choi: 'Người bệnh từ chối tham gia',
  can_ho_tro: 'Người bệnh không hiểu hướng dẫn / cần hỗ trợ',
  loi_ky_thuat: 'Lỗi kỹ thuật hoặc thiết bị',
  ly_do_khac: 'Lý do lâm sàng khác',
};

// 6 Nhóm hoạt động chuẩn lâm sàng có thể cấu hình
export const DEFAULT_ACTIVITY_GROUPS: ClinicalActivityGroupItem[] = [
  {
    id: 'grp_1',
    name: 'Nhóm 1. HOẠT ĐỘNG HÔ HẤP',
    order: 1,
    is_active: true,
    suggested_surgery_regions: ['Ngực/lồng ngực', 'Ổ bụng'],
  },
  {
    id: 'grp_2',
    name: 'Nhóm 2. XOAY TRỞ VÀ THAY ĐỔI TƯ THẾ TRÊN GIƯỜNG',
    order: 2,
    is_active: true,
    suggested_surgery_regions: ['Ổ bụng', 'Vùng chậu/tầng sinh môn', 'Ngực/lồng ngực'],
  },
  {
    id: 'grp_3',
    name: 'Nhóm 3. CHUYỂN TƯ THẾ',
    order: 3,
    is_active: true,
    suggested_surgery_regions: ['Ổ bụng', 'Vùng chậu/tầng sinh môn', 'Chi dưới'],
  },
  {
    id: 'grp_4',
    name: 'Nhóm 4. ĐỨNG, ĐI LẠI VÀ CHỊU LỰC',
    order: 4,
    is_active: true,
    suggested_surgery_regions: ['Chi dưới', 'Ổ bụng', 'Vùng chậu/tầng sinh môn'],
  },
  {
    id: 'grp_5',
    name: 'Nhóm 5. VẬN ĐỘNG VÙNG CƠ THỂ HOẶC CHI ĐƯỢC PHẪU THUẬT',
    order: 5,
    is_active: true,
    suggested_surgery_regions: ['Chi trên', 'Chi dưới'],
  },
  {
    id: 'grp_6',
    name: 'Nhóm 6. HOẠT ĐỘNG ĐẶC THÙ THEO LOẠI PHẪU THUẬT',
    order: 6,
    is_active: true,
    suggested_surgery_regions: ['Đầu, cổ, miệng và họng', 'Vùng khác'],
  },
];

export const DEFAULT_CLINICAL_CONFIG: ClinicalConfig = {
  // 7 Vùng / Loại phẫu thuật có thể cấu hình
  surgery_groups: [
    { id: 'surg_1', name: 'Ngực/lồng ngực', order: 1, is_active: true },
    { id: 'surg_2', name: 'Ổ bụng', order: 2, is_active: true },
    { id: 'surg_3', name: 'Chi trên', order: 3, is_active: true },
    { id: 'surg_4', name: 'Chi dưới', order: 4, is_active: true },
    { id: 'surg_5', name: 'Đầu, cổ, miệng và họng', order: 5, is_active: true },
    { id: 'surg_6', name: 'Vùng chậu/tầng sinh môn', order: 6, is_active: true },
    { id: 'surg_7', name: 'Vùng khác', order: 7, is_active: true },
  ],
  activity_groups: DEFAULT_ACTIVITY_GROUPS,
  // 6 Nhóm hoạt động cụ thể (19 hoạt động chi tiết)
  activities: [
    // Nhóm 1. HOẠT ĐỘNG HÔ HẤP
    { id: 'act_1_1', group_id: 'grp_1', group_name: 'Nhóm 1. HOẠT ĐỘNG HÔ HẤP', name: 'Ho theo hướng dẫn', order: 1, is_active: true },
    { id: 'act_1_2', group_id: 'grp_1', group_name: 'Nhóm 1. HOẠT ĐỘNG HÔ HẤP', name: 'Hít sâu theo hướng dẫn', order: 2, is_active: true },
    { id: 'act_1_3', group_id: 'grp_1', group_name: 'Nhóm 1. HOẠT ĐỘNG HÔ HẤP', name: 'Hít sâu và ho theo hướng dẫn', order: 3, is_active: true },

    // Nhóm 2. XOAY TRỞ VÀ THAY ĐỔI TƯ THẾ TRÊN GIƯỜNG
    { id: 'act_2_1', group_id: 'grp_2', group_name: 'Nhóm 2. XOAY TRỞ VÀ THAY ĐỔI TƯ THẾ TRÊN GIƯỜNG', name: 'Xoay nghiêng sang bên', order: 4, is_active: true },
    { id: 'act_2_2', group_id: 'grp_2', group_name: 'Nhóm 2. XOAY TRỞ VÀ THAY ĐỔI TƯ THẾ TRÊN GIƯỜNG', name: 'Trở mình hoặc điều chỉnh tư thế nằm', order: 5, is_active: true },
    { id: 'act_2_3', group_id: 'grp_2', group_name: 'Nhóm 2. XOAY TRỞ VÀ THAY ĐỔI TƯ THẾ TRÊN GIƯỜNG', name: 'Di chuyển người trên giường theo hướng dẫn', order: 6, is_active: true },
    { id: 'act_2_4', group_id: 'grp_2', group_name: 'Nhóm 2. XOAY TRỞ VÀ THAY ĐỔI TƯ THẾ TRÊN GIƯỜNG', name: 'Ngồi dậy từ tư thế nằm', order: 7, is_active: true },

    // Nhóm 3. CHUYỂN TƯ THẾ
    { id: 'act_3_1', group_id: 'grp_3', group_name: 'Nhóm 3. CHUYỂN TƯ THẾ', name: 'Từ nằm sang ngồi', order: 8, is_active: true },
    { id: 'act_3_2', group_id: 'grp_3', group_name: 'Nhóm 3. CHUYỂN TƯ THẾ', name: 'Ngồi mép giường', order: 9, is_active: true },
    { id: 'act_3_3', group_id: 'grp_3', group_name: 'Nhóm 3. CHUYỂN TƯ THẾ', name: 'Từ ngồi sang đứng', order: 10, is_active: true },
    { id: 'act_3_4', group_id: 'grp_3', group_name: 'Nhóm 3. CHUYỂN TƯ THẾ', name: 'Chuyển từ giường sang ghế hoặc cáng', order: 11, is_active: true },

    // Nhóm 4. ĐỨNG, ĐI LẠI VÀ CHỊU LỰC
    { id: 'act_4_1', group_id: 'grp_4', group_name: 'Nhóm 4. ĐỨNG, ĐI LẠI VÀ CHỊU LỰC', name: 'Đứng lên', order: 12, is_active: true },
    { id: 'act_4_2', group_id: 'grp_4', group_name: 'Nhóm 4. ĐỨNG, ĐI LẠI VÀ CHỊU LỰC', name: 'Đứng chịu lực theo hướng dẫn', order: 13, is_active: true },
    { id: 'act_4_3', group_id: 'grp_4', group_name: 'Nhóm 4. ĐỨNG, ĐI LẠI VÀ CHỊU LỰC', name: 'Đi vài bước', order: 14, is_active: true },
    { id: 'act_4_4', group_id: 'grp_4', group_name: 'Nhóm 4. ĐỨNG, ĐI LẠI VÀ CHỊU LỰC', name: 'Đi lại theo kế hoạch phục hồi chức năng', order: 15, is_active: true },

    // Nhóm 5. VẬN ĐỘNG VÙNG CƠ THỂ HOẶC CHI ĐƯỢC PHẪU THUẬT
    { id: 'act_5_1', group_id: 'grp_5', group_name: 'Nhóm 5. VẬN ĐỘNG VÙNG CƠ THỂ HOẶC CHI ĐƯỢC PHẪU THUẬT', name: 'Gấp hoặc duỗi chi theo hướng dẫn', order: 16, is_active: true },
    { id: 'act_5_2', group_id: 'grp_5', group_name: 'Nhóm 5. VẬN ĐỘNG VÙNG CƠ THỂ HOẶC CHI ĐƯỢC PHẪU THUẬT', name: 'Cử động khớp đã phẫu thuật theo kế hoạch phục hồi chức năng', order: 17, is_active: true },
    { id: 'act_5_3', group_id: 'grp_5', group_name: 'Nhóm 5. VẬN ĐỘNG VÙNG CƠ THỂ HOẶC CHI ĐƯỢC PHẪU THUẬT', name: 'Cử động vai hoặc cánh tay theo hướng dẫn', order: 18, is_active: true },
    { id: 'act_5_4', group_id: 'grp_5', group_name: 'Nhóm 5. VẬN ĐỘNG VÙNG CƠ THỂ HOẶC CHI ĐƯỢC PHẪU THUẬT', name: 'Sử dụng chi đã phẫu thuật trong hoạt động được cho phép', order: 19, is_active: true },

    // Nhóm 6. HOẠT ĐỘNG ĐẶC THÙ THEO LOẠI PHẪU THUẬT
    { id: 'act_6_1', group_id: 'grp_6', group_name: 'Nhóm 6. HOẠT ĐỘNG ĐẶC THÙ THEO LOẠI PHẪU THUẬT', name: 'Nuốt sau một số phẫu thuật vùng miệng–họng', order: 20, is_active: true },
    { id: 'act_6_2', group_id: 'grp_6', group_name: 'Nhóm 6. HOẠT ĐỘNG ĐẶC THÙ THEO LOẠI PHẪU THUẬT', name: 'Nói hoặc cử động cổ sau một số phẫu thuật đầu–cổ, nếu được phép', order: 21, is_active: true },
    { id: 'act_6_3', group_id: 'grp_6', group_name: 'Nhóm 6. HOẠT ĐỘNG ĐẶC THÙ THEO LOẠI PHẪU THUẬT', name: 'Hoạt động đặc thù khác do nhân viên y tế lựa chọn từ danh mục đã được đơn vị phê duyệt', order: 22, is_active: true },
  ],
  care_locations: [
    { id: 'loc_1', name: 'Phòng hồi tỉnh (PACU)', order: 1, is_active: true },
    { id: 'loc_2', name: 'Khoa hậu phẫu', order: 2, is_active: true },
    { id: 'loc_3', name: 'Khoa sản / buồng bệnh', order: 3, is_active: true },
    { id: 'loc_4', name: 'Đơn vị chăm sóc đặc biệt (ICU)', order: 4, is_active: true },
    { id: 'loc_5', name: 'Khác đã được phê duyệt', order: 5, is_active: true },
  ],
  anchor_left_label: 'Không đau',
  anchor_right_label: 'Đau dữ dội nhất có thể tưởng tượng',
  rounding_decimals: 1,
  updated_at: new Date().toISOString(),
};
