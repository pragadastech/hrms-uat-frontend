import React, { createContext, useState, useContext, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const toggle = () => setIsCollapsed(c => !c);
  const toggleMobileMenu = () => setIsMobileMenuOpen(c => !c);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  return (
    <SidebarContext.Provider value={{
      isCollapsed,
      setIsCollapsed,
      toggle,
      isMobileMenuOpen,
      setIsMobileMenuOpen,
      toggleMobileMenu
    }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}

export default SidebarContext;
