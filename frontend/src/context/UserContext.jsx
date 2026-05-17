import { createContext, useContext, useState } from 'react';

// Heslá sú uložené iba na frontende – nie je to produkčná bezpečnosť,
// ale postačuje pre interné firemné použitie.
const CREDENTIALS = [
  { password: 'ZS25Michal', name: 'Michal', role: 'majitel', initials: 'MM' },
  { password: 'Edita123',   name: 'Edita',  role: 'user',    initials: 'ED' },
];

const getStored = () => {
  try {
    const s = localStorage.getItem('zs_current_user');
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(getStored);

  const login = (password) => {
    const cred = CREDENTIALS.find(c => c.password === password);
    if (!cred) return { success: false, error: 'Nesprávne prístupové heslo' };
    const user = { name: cred.name, role: cred.role, initials: cred.initials };
    localStorage.setItem('zs_current_user', JSON.stringify(user));
    setCurrentUser(user);
    return { success: true };
  };

  const logout = () => {
    localStorage.removeItem('zs_current_user');
    setCurrentUser(null);
  };

  return (
    <UserContext.Provider value={{
      currentUser,
      login,
      logout,
      isLoggedIn: currentUser !== null,
      isOwner: currentUser?.role === 'majitel',
    }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
