import React, { createContext, useContext, useEffect, useState } from 'react';

const TenantContext = createContext(null);

export const useTenant = () => {
    const ctx = useContext(TenantContext);
    if (!ctx) throw new Error('useTenant must be used within TenantProvider');
    return ctx;
};

export const TenantProvider = ({ children }) => {
    const [currentTenant, setCurrentTenant] = useState(null);

    useEffect(() => {
        try {
            const saved = window.safeSessionStorage.getItem('currentTenant');
            if (saved) setCurrentTenant(JSON.parse(saved));
        } catch { }
    }, []);

    const selectTenant = (tenant) => {
        setCurrentTenant(tenant);
        try {
            window.safeSessionStorage.setItem('currentTenant', JSON.stringify(tenant));
            if (tenant?.id) window.safeSessionStorage.setItem('currentTenantId', String(tenant.id));
            if (tenant?.slug) window.safeSessionStorage.setItem('currentTenantSlug', tenant.slug);
        } catch { }
    };

    const clearTenant = () => {
        setCurrentTenant(null);
        try {
            window.safeSessionStorage.removeItem('currentTenant');
            window.safeSessionStorage.removeItem('currentTenantId');
            window.safeSessionStorage.removeItem('currentTenantSlug');
        } catch { }
    };

    return (
        <TenantContext.Provider value={{ currentTenant, selectTenant, clearTenant }}>
            {children}
        </TenantContext.Provider>
    );
};
