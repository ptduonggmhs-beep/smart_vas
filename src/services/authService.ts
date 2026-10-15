import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppUser, UserRole } from '../types';

const AUTH_STORAGE_KEY = '@smart_vas_current_user';

// Danh sách tài khoản Nghiên cứu viên chuẩn được định danh trước
const DEFAULT_RESEARCHERS: (AppUser & { pass: string; pin: string })[] = [
  {
    id: 'ncv-01',
    email: 'ncv@smartvas.vn',
    pass: 'ncv123456',
    pin: '8888',
    name: 'BS. Nghiên cứu viên Lâm sàng',
    role: 'ncv',
    title: 'Nghiên cứu viên (NCV)',
  },
  {
    id: 'admin-01',
    email: 'admin@smartvas.vn',
    pass: 'admin123456',
    pin: '9999',
    name: 'PGS. TS. Chủ nhiệm Đề tài',
    role: 'admin',
    title: 'Quản trị viên Đề tài (Admin)',
  },
];

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
   * Đăng nhập bằng Email & Mật khẩu hoặc Mã PIN nhanh của NCV
   */
  async loginNCV(accountOrPin: string, password?: string): Promise<{ success: boolean; user?: AppUser; error?: string }> {
    const input = accountOrPin.trim();

    // 1. Kiểm tra đăng nhập nhanh bằng mã PIN 4 số (Dành cho BS thao tác nhanh tại giường bệnh)
    if (!password) {
      const foundByPin = DEFAULT_RESEARCHERS.find(r => r.pin === input);
      if (foundByPin) {
        const user: AppUser = {
          id: foundByPin.id,
          email: foundByPin.email,
          name: foundByPin.name,
          role: foundByPin.role,
          title: foundByPin.title,
        };
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        return { success: true, user };
      }
      return { success: false, error: 'Mã PIN NCV không chính xác (Mặc định: 8888 hoặc 9999)' };
    }

    // 2. Kiểm tra đăng nhập bằng Email / Tên tài khoản & Mật khẩu
    const foundByEmail = DEFAULT_RESEARCHERS.find(
      r => r.email.toLowerCase() === input.toLowerCase() && r.pass === password
    );

    if (foundByEmail) {
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

    return { success: false, error: 'Email hoặc mật khẩu NCV không đúng.' };
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
