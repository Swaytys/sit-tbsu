import React, { createContext, useContext, useState } from 'react';

export type UserRole = 'owner' | 'admin' | 'kasir' | 'staf';

export interface User {
  name: string;
  username: string;
  role: UserRole;
  roleLabel: string;
}

const DEMO_USERS: Record<UserRole, User> = {
  owner: { name: 'Hendra Wijaya', username: 'hendra.w', role: 'owner', roleLabel: 'Owner' },
  admin: { name: 'Budi Santoso', username: 'budi.s', role: 'admin', roleLabel: 'Administrator' },
  kasir: { name: 'Siti Rahayu', username: 'siti.r', role: 'kasir', roleLabel: 'Kasir' },
  staf: { name: 'Agus Prasetyo', username: 'agus.p', role: 'staf', roleLabel: 'Staf Penjualan' },
};

interface AuthContextType {
  user: User | null;
  login: (role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = (role: UserRole) => {
    setUser(DEMO_USERS[role]);
  };

  const logout = () => {
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export { DEMO_USERS };
