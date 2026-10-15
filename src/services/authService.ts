import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppUser, ResearcherAccount } from '../types';
import { FirebaseService } from './firebaseService';

const AUTH_STORAGE_KEY = '@smart_vas_current_user';

export const AuthService = {
  /**
   * Lấy người dùng đã đăng nhập hiện tại từ AsyncStorage
   */
  async getCurrentUser(): Promise<AppUser | null> {
    try {
      const data = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  /**
   * Đăng nhập bằng Email & Mật khẩu hoặc Mã PIN nhanh của NCV từ CSDL
   */
  async loginNCV(accountOrPin: string, password?: string): Promise<{ success: boolean; user?: AppUser; error?: string }> {
    const input = accountOrPin.trim();
    if (!input) {
      return { success: false, error: 'Vui lòng nhập thông tin xác thực.' };
    }

    try {
      // 1. Kiểm tra đăng nhập nhanh bằng mã PIN (Dành cho BS thao tác nhanh tại giường bệnh)
      if (!password) {
        const found = await FirebaseService.getResearcherByPin(input);
        if (found) {
          if (found.is_active === false) {
            return { success: false, error: 'Tài khoản liên kết với mã PIN này hiện đang bị tạm khóa trong CSDL.' };
          }
          const user: AppUser = {
            id: found.id,
            email: found.email,
            name: found.name,
            role: found.role,
            title: found.title,
          };
          await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
          return { success: true, user };
        }
        return { success: false, error: 'Mã PIN không chính xác hoặc chưa được cấp trong CSDL.' };
      }

      // 2. Kiểm tra đăng nhập bằng Email / Tên tài khoản & Mật khẩu
      const allResearchers = await FirebaseService.getAllResearchers();
      const foundByEmail = allResearchers.find(
        (r) => r.email.trim().toLowerCase() === input.toLowerCase() && r.password === password
      );

      if (foundByEmail) {
        if (foundByEmail.is_active === false) {
          return { success: false, error: 'Tài khoản này hiện đang bị tạm khóa trong CSDL.' };
        }
        const user: AppUser = {
          id: foundByEmail.id,
          email: foundByEmail.email,
          name: foundByEmail.name,
          role: foundByEmail.role,
          title: foundByEmail.title,
        };
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        return { success: true, user };
      }

      return { success: false, error: 'Email hoặc mật khẩu không chính xác trong CSDL.' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Lỗi xác thực người dùng từ CSDL' };
    }
  },

  /**
   * Lấy danh sách toàn bộ tài khoản NCV & mã PIN từ CSDL
   */
  async getAllResearchers(): Promise<ResearcherAccount[]> {
    return FirebaseService.getAllResearchers();
  },

  /**
   * Tạo mới hoặc cập nhật tài khoản NCV & mã PIN vào CSDL
   */
  async saveResearcher(researcher: ResearcherAccount): Promise<{ success: boolean; error?: string }> {
    // Kiểm tra trùng lặp mã PIN với tài khoản khác
    const all = await FirebaseService.getAllResearchers();
    const pinConflict = all.find(
      (r) => r.id !== researcher.id && r.pin.trim() === researcher.pin.trim()
    );
    if (pinConflict) {
      return { success: false, error: `Mã PIN ${researcher.pin} đã được gán cho ${pinConflict.name}. Vui lòng chọn mã PIN khác.` };
    }

    // Kiểm tra trùng lặp email với tài khoản khác
    const emailConflict = all.find(
      (r) => r.id !== researcher.id && r.email.trim().toLowerCase() === researcher.email.trim().toLowerCase()
    );
    if (emailConflict) {
      return { success: false, error: `Email ${researcher.email} đã tồn tại trong hệ thống. Vui lòng chọn email khác.` };
    }

    return FirebaseService.saveResearcher(researcher);
  },

  /**
   * Xóa tài khoản NCV khỏi CSDL
   */
  async deleteResearcher(id: string): Promise<{ success: boolean; error?: string }> {
    return FirebaseService.deleteResearcher(id);
  },

  /**
   * Cập nhật mã PIN nhanh cho tài khoản NCV
   */
  async updatePin(id: string, newPin: string): Promise<{ success: boolean; error?: string }> {
    const trimmedPin = newPin.trim();
    if (!trimmedPin || trimmedPin.length < 4 || trimmedPin.length > 6 || !/^\d+$/.test(trimmedPin)) {
      return { success: false, error: 'Mã PIN phải gồm từ 4 đến 6 chữ số.' };
    }

    const all = await FirebaseService.getAllResearchers();
    const pinConflict = all.find((r) => r.id !== id && r.pin.trim() === trimmedPin);
    if (pinConflict) {
      return { success: false, error: `Mã PIN ${trimmedPin} đã được gán cho ${pinConflict.name}. Vui lòng chọn mã khác.` };
    }

    const target = all.find((r) => r.id === id);
    if (!target) {
      return { success: false, error: 'Không tìm thấy tài khoản cần đổi mã PIN.' };
    }

    return FirebaseService.saveResearcher({
      ...target,
      pin: trimmedPin,
      updated_at: new Date().toISOString(),
    });
  },

  /**
   * Đăng xuất quyền NCV (Quay về chế độ bệnh nhân)
   */
  async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.error('Error logging out:', e);
    }
  },

  /**
   * Kiểm tra người dùng hiện tại có quyền NCV trở lên hay không
   */
  isNCVorHigher(user: AppUser | null): boolean {
    if (!user) return false;
    return user.role === 'ncv' || user.role === 'admin';
  },

  /**
   * Kiểm tra người dùng có quyền Admin cao nhất không
   */
  isAdmin(user: AppUser | null): boolean {
    return user?.role === 'admin';
  },
};
