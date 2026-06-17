import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type User = {
  id: string;
  name: string;
  phone: string;
  email: string;
  role?: 'client' | 'master';
  registeredAt: string;
};

type AuthContextType = {
  user: User | null;
  profile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, phone: string) => Promise<void>;
  signOut: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Проверяем, есть ли пользователь в localStorage при загрузке
  useEffect(() => {
    const savedUser = localStorage.getItem('masterbul_current_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setProfile(parsedUser);
      } catch (e) {
        console.error('Ошибка загрузки пользователя:', e);
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const users = JSON.parse(localStorage.getItem('masterbul_users') || '[]');
    const foundUser = users.find((u: any) => u.email === email);
    
    if (!foundUser) {
      throw new Error('Пользователь не найден');
    }
    
    localStorage.setItem('masterbul_current_user', JSON.stringify(foundUser));
    setUser(foundUser);
    setProfile(foundUser);
  };

  const signUp = async (email: string, password: string, name: string, phone: string) => {
    const users = JSON.parse(localStorage.getItem('masterbul_users') || '[]');
    
    // Проверяем, не существует ли уже такой пользователь
    if (users.find((u: any) => u.email === email)) {
      throw new Error('Пользователь с таким email уже существует');
    }
    if (users.find((u: any) => u.phone === phone)) {
      throw new Error('Пользователь с таким телефоном уже существует');
    }
    
    const newUser: User = {
      id: Date.now().toString(),
      name: name || 'Пользователь',
      phone: phone,
      email: email,
      registeredAt: new Date().toISOString(),
    };
    
    users.push(newUser);
    localStorage.setItem('masterbul_users', JSON.stringify(users));
    localStorage.setItem('masterbul_current_user', JSON.stringify(newUser));
    setUser(newUser);
    setProfile(newUser);
  };

  const signOut = () => {
    localStorage.removeItem('masterbul_current_user');
    setUser(null);
    setProfile(null);
    window.location.href = '/';
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...data };
    localStorage.setItem('masterbul_current_user', JSON.stringify(updatedUser));
    
    const users = JSON.parse(localStorage.getItem('masterbul_users') || '[]');
    const index = users.findIndex((u: any) => u.id === user.id);
    if (index !== -1) {
      users[index] = updatedUser;
      localStorage.setItem('masterbul_users', JSON.stringify(users));
    }
    
    setUser(updatedUser);
    setProfile(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
