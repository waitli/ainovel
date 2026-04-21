import { createContext, useContext } from 'react';

type UserContextValue = {
  user: any;
  setUser: (u: any) => void;
  loading: boolean;
};

export const UserCtx = createContext<UserContextValue>({
  user: null,
  setUser: () => {},
  loading: true,
});

export const useUser = () => useContext(UserCtx);
