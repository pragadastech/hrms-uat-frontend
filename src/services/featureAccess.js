import api from './api';

// Feature Access Service
export const featureAccessAPI = {
    // Get current tenant's feature access information
    getFeatureAccess: () => {
        const tenantId = getTenantIdFromStorage();
        const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
        return api.get('/features/access', config);
    },

    // Check if a specific feature is available
    checkFeature: (feature) => {
        const tenantId = getTenantIdFromStorage();
        const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
        return api.get(`/features/check/${feature}`, config);
    },

    // Get all available features in the system
    getAllFeatures: () => {
        const tenantId = getTenantIdFromStorage();
        const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
        return api.get('/features/all', config);
    },

    // Get trial restricted features
    getTrialRestrictedFeatures: () => {
        const tenantId = getTenantIdFromStorage();
        const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
        return api.get('/features/trial-restricted', config);
    },

    // Get current tenant's available features
    getAvailableFeatures: () => {
        const tenantId = getTenantIdFromStorage();
        const config = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : {};
        return api.get('/features/available', config);
    }
};

// Helper to read tenant id for ad-hoc headers
const getTenantIdFromStorage = () => {
    try {
        return window.safeSessionStorage.getItem('currentTenantId');
    } catch {
        return null;
    }
};
