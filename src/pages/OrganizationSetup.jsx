import { useState, useEffect } from 'react';
import { Building2, Mail, Phone, MapPin, Globe, Upload, Save, Loader2, Edit2, X, Crown, Calendar, Users, CheckCircle, ArrowUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { organizationAPI, getApiBaseUrl } from '../services/api';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';

export default function OrganizationSetup() {
  const { fetchFeatureAccess } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);

  const [organizationData, setOrganizationData] = useState({
    company_name: '',
    domain: '',
    address: '',
    contact_email: '',
    contact_number: '',
    industry: '',
    website_url: '',
    company_size: '',
    logo_url: null,
    company_pan: '',
    gst_number: ''
  });

  // Subscription states
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  // Track which specific plan is being processed so only that plan's button shows spinner
  const [processingPlanId, setProcessingPlanId] = useState(null);

  // Fetch organization details
  const fetchOrganizationData = async () => {
    try {
      setLoading(true);
      const response = await organizationAPI.get();
      const data = response.data || {};

      setOrganizationData({
        company_name: data.company_name || '',
        domain: data.domain || '',
        address: data.address || '',
        contact_email: data.contact_email || '',
        contact_number: data.contact_number || '',
        industry: data.industry || '',
        website_url: data.website_url || data.websiteUrl || '',
        company_size: data.company_size || data.companySize || '',
        logo_url: data.logo_url || data.logoUrl || null,
        company_pan: data.company_pan || '',
        gst_number: data.gst_number || ''
      });

      if (data.logo_url || data.logoUrl) {
        setLogoPreview(data.logo_url || data.logoUrl);
      }
    } catch (error) {
      console.error('Error fetching organization data:', error);
      toast.error('Failed to fetch organization details');
    } finally {
      setLoading(false);
    }
  };

  // Fetch subscription details
  const fetchSubscriptionData = async () => {
    try {
      const response = await organizationAPI.getSubscription();
      setSubscriptionData(response.data || null);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    }
  };

  // Fetch available plans
  const fetchAvailablePlans = async () => {
    try {
      const response = await organizationAPI.getAvailablePlans();
      setAvailablePlans(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching available plans:', error);
    }
  };

  // Helper to dynamically load Razorpay script reliably
  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.Razorpay) {
        resolve(true);
        return;
      }
      const existingScript = document.getElementById('razorpay-js');
      if (existingScript) {
        existingScript.remove();
      }
      const script = document.createElement('script');
      script.id = 'razorpay-js';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      const timeout = setTimeout(() => {
        if (window.Razorpay) {
          resolve(true);
        } else {
          console.error('Razorpay SDK loading timed out');
          resolve(false);
        }
      }, 10000);
      script.onload = () => {
        clearTimeout(timeout);
        if (window.Razorpay) {
          resolve(true);
        } else {
          console.error('Razorpay script loaded but window.Razorpay is undefined');
          resolve(false);
        }
      };
      script.onerror = (err) => {
        clearTimeout(timeout);
        console.error('Failed to load Razorpay script:', err);
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  // Handle plan upgrade with Razorpay payment
  const handlePlanUpgrade = async (plan) => {
    try {
      setProcessingPlanId(plan.planId);

      const res = await loadRazorpay();

      if (!res || !window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Are you online or is an ad-blocker blocking checkout.razorpay.com?');
      }

      // Step 1: Create Razorpay order
      const orderResponse = await organizationAPI.createRazorpayOrder(plan.planId);
      const orderData = orderResponse.data;

      if (!orderData || !orderData.orderId) {
        throw new Error('Failed to create payment order');
      }

      // Step 2: Get Razorpay key
      const keyResponse = await organizationAPI.getRazorpayKey();
      const razorpayKey = keyResponse.data?.key;

      if (!razorpayKey) {
        throw new Error('Razorpay key not available');
      }

      // Step 3: Open Razorpay checkout
      const options = {
        key: razorpayKey,
        amount: Math.round(parseFloat(orderData.amount) * 100), // Convert to paise
        currency: orderData.currency || 'INR',
        name: orderData.name || 'HRMS Subscription',
        description: orderData.description || `Payment for ${orderData.planName || plan.name}`,
        order_id: orderData.orderId,
        prefill: {
          name: orderData.customerName || '',
          email: orderData.customerEmail || '',
          contact: orderData.customerPhone || ''
        },
        theme: {
          color: orderData.theme || '#3399cc'
        },
        handler: async function (response) {
          try {
            setProcessingPlanId(plan.planId);

            // Step 4: Verify payment on backend
            const verifyResponse = await organizationAPI.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              planId: plan.planId
            });

            if (verifyResponse?.data?.message) {
              toast.success('Payment successful! Plan upgraded.');
              setShowUpgradeModal(false);
              // Refresh feature access / subscription status in auth context
              await fetchFeatureAccess('admin');
              // Refresh subscription data
              setTimeout(() => {
                fetchSubscriptionData();
              }, 500);
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (error) {
            console.error('Error verifying payment:', error);
            toast.error(error.response?.data?.error || 'Payment verification failed. Please contact support.');
          } finally {
            setProcessingPlanId(null);
          }
        },
        modal: {
          ondismiss: function () {
            setProcessingPlanId(null);
            toast.error('Payment cancelled');
          }
        }
      };

      // Check if Razorpay is loaded
      if (window.Razorpay) {
        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        throw new Error('Razorpay SDK not loaded. Please refresh the page.');
      }
    } catch (error) {
      console.error('Error initiating payment:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to initiate payment. Please try again.');
      setProcessingPlanId(null);
    }
  };

  useEffect(() => {
    fetchOrganizationData();
    fetchSubscriptionData();
    fetchAvailablePlans();
    loadRazorpay();
  }, []);

  // Helper for full logo URL
  const getFullLogoUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http')) return url;

    const base = getApiBaseUrl();
    // If base is a relative path like '/api' (dev mode with proxy), 
    // we use it as is, but browser will resolve it to frontend origin.
    // If it's a full URL (prod mode), we need to ensure the origin is prepended.
    if (base.startsWith('http')) {
      const origin = base.replace(/\/api$/, '');
      return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    return url;
  };

  // Handle logo upload
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('Logo file size should be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      const formData = new FormData();
      if (organizationData.company_name) formData.append('name', organizationData.company_name);
      if (organizationData.domain) formData.append('domain', organizationData.domain);
      if (organizationData.address) formData.append('address', organizationData.address);
      if (organizationData.contact_email) formData.append('contactEmail', organizationData.contact_email);
      if (organizationData.contact_number) formData.append('contactNumber', organizationData.contact_number);
      if (organizationData.industry) formData.append('industry', organizationData.industry);
      if (organizationData.website_url) formData.append('websiteUrl', organizationData.website_url);
      if (organizationData.company_size) formData.append('companySize', organizationData.company_size);
      if (organizationData.company_pan) formData.append('companyPan', organizationData.company_pan);
      if (organizationData.gst_number) formData.append('gstNumber', organizationData.gst_number);

      if (logoFile) {
        formData.append('file', logoFile);
      }

      await organizationAPI.save(formData, true);

      toast.success('Organization details updated successfully');
      setEditing(false);
      fetchOrganizationData();
    } catch (error) {
      console.error('Error updating organization:', error);
      toast.error(error.response?.data?.message || 'Failed to update organization details');
    } finally {
      setSaving(false);
    }
  };

  // Handle input change
  const handleChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setOrganizationData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setOrganizationData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  if (loading) {
    return (
      <div className="main-content">
        <Header title="Organization Setup" subtitle="Manage organization details and settings" />
        <div className="page-content">
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 10px' }} />
            <p>Loading organization details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <Header title="Organization Setup" subtitle="Manage organization details and settings" />

      <div className="page-content">
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">Organization Information</h3>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="hr-btn-primary"
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Edit2 size={16} />
                Edit
              </button>
            )}
            {editing && (
              <button
                onClick={() => {
                  setEditing(false);
                  setLogoFile(null);
                  setLogoPreview(organizationData.logo_url);
                  fetchOrganizationData();
                }}
                className="hr-btn-secondary"
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <X size={16} />
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              {/* Logo Section */}
              <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <div style={{ marginBottom: '12px' }}>
                  {logoPreview ? (
                    <img
                      src={getFullLogoUrl(logoPreview)}
                      alt="Organization Logo"
                      onError={(e) => {
                        console.error('Logo failed to load:', logoPreview);
                        e.target.onerror = null;
                        setLogoPreview(null); // Fallback to icon
                      }}
                      style={{
                        width: '120px',
                        height: '120px',
                        objectFit: 'contain',
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        padding: '10px',
                        backgroundColor: '#f9fafb',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '120px',
                        height: '120px',
                        margin: '0 auto',
                        borderRadius: '8px',
                        border: '2px dashed #d1d5db',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f9fafb'
                      }}
                    >
                      <Building2 size={48} style={{ color: '#9ca3af' }} />
                    </div>
                  )}
                </div>
                {editing && (
                  <div>
                    <label
                      htmlFor="logo-upload"
                      className="hr-btn-secondary"
                      style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Upload size={16} />
                      {logoPreview ? 'Change Logo' : 'Upload Logo'}
                    </label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      style={{ display: 'none' }}
                    />
                  </div>
                )}
              </div>

              {/* Basic Information */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                  Basic Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="hr-form-group">
                    <label>
                      <Building2 size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={organizationData.company_name}
                      onChange={(e) => handleChange('company_name', e.target.value)}
                      disabled={!editing}
                      required
                      placeholder="Enter company name"
                    />
                  </div>

                  <div className="hr-form-group">
                    <label>
                      <Globe size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                      Domain
                    </label>
                    <input
                      type="text"
                      value={organizationData.domain}
                      onChange={(e) => handleChange('domain', e.target.value)}
                      disabled={!editing}
                      placeholder="Enter domain"
                    />
                  </div>

                  <div className="hr-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>
                      <MapPin size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                      Address
                    </label>
                    <textarea
                      value={organizationData.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                      disabled={!editing}
                      rows={3}
                      placeholder="Enter organization address"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <div className="hr-form-group">
                    <label>
                      <Mail size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                      Contact Email *
                    </label>
                    <input
                      type="email"
                      value={organizationData.contact_email}
                      onChange={(e) => handleChange('contact_email', e.target.value)}
                      disabled={!editing}
                      required
                      placeholder="contact@company.com"
                    />
                  </div>

                  <div className="hr-form-group">
                    <label>
                      <Phone size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                      Contact Number
                    </label>
                    <input
                      type="tel"
                      value={organizationData.contact_number}
                      onChange={(e) => handleChange('contact_number', e.target.value)}
                      disabled={!editing}
                      placeholder="+91-9876543210"
                    />
                  </div>

                  <div className="hr-form-group">
                    <label>
                      <Building2 size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                      Industry
                    </label>
                    <input
                      type="text"
                      value={organizationData.industry}
                      onChange={(e) => handleChange('industry', e.target.value)}
                      disabled={!editing}
                      placeholder="Enter industry"
                    />
                  </div>

                  <div className="hr-form-group">
                    <label>
                      <Building2 size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                      Company PAN
                    </label>
                    <input
                      type="text"
                      value={organizationData.company_pan}
                      onChange={(e) => handleChange('company_pan', e.target.value.toUpperCase())}
                      disabled={!editing}
                      placeholder="Enter company PAN"
                    />
                  </div>

                  <div className="hr-form-group">
                    <label>
                      <Building2 size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                      GST Number
                    </label>
                    <input
                      type="text"
                      value={organizationData.gst_number}
                      onChange={(e) => handleChange('gst_number', e.target.value.toUpperCase())}
                      disabled={!editing}
                      placeholder="Enter GST number"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                  Additional Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="hr-form-group">
                    <label>
                      <Globe size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={organizationData.website_url || ''}
                      onChange={(e) => handleChange('website_url', e.target.value)}
                      disabled={!editing}
                      placeholder="https://www.company.com"
                    />
                  </div>

                  <div className="hr-form-group">
                    <label>
                      <Building2 size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                      Company Size
                    </label>
                    <select
                      value={organizationData.company_size || ''}
                      onChange={(e) => handleChange('company_size', e.target.value)}
                      disabled={!editing}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select company size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="501-1000">501-1000 employees</option>
                      <option value="1000+">1000+ employees</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {editing && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setLogoFile(null);
                      setLogoPreview(organizationData.logo_url);
                      fetchOrganizationData();
                    }}
                    className="hr-btn-secondary"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="hr-btn-primary"
                    disabled={saving}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Subscription Details Card */}
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">Subscription Details</h3>
            {subscriptionData && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {((subscriptionData.remainingDays ?? subscriptionData.remaining_days ?? 999) <= 7 || subscriptionData.status === 'EXPIRED') && (
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="hr-btn-primary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#10b981',
                      borderColor: '#10b981'
                    }}
                  >
                    <ArrowUp size={16} />
                    Renew Plan
                  </button>
                )}
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="hr-btn-primary"
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ArrowUp size={16} />
                  Upgrade Plan
                </button>
              </div>
            )}
          </div>

          <div className="card-body" style={{ padding: '16px 20px' }}>
            {subscriptionData ? (
              <>
                {/* Expiry Warning Banner for 1 week / 7 days */}
                {(subscriptionData.remainingDays ?? subscriptionData.remaining_days ?? 999) <= 7 && (
                  <div style={{
                    padding: '12px 16px',
                    marginBottom: '16px',
                    borderRadius: '8px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Calendar size={18} style={{ color: '#d97706', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
                          {(subscriptionData.remainingDays ?? subscriptionData.remaining_days ?? 0) <= 0
                            ? 'Your subscription plan has expired!'
                            : `Your subscription plan is expiring in ${subscriptionData.remainingDays ?? subscriptionData.remaining_days} day(s)!`}
                        </div>
                        <div style={{ fontSize: '12px', color: '#b45309' }}>
                          Renew your current plan or upgrade to avoid any disruption to your organization's services.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="hr-btn-primary"
                      style={{
                        padding: '6px 14px',
                        fontSize: '12px',
                        background: '#d97706',
                        borderColor: '#d97706',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <ArrowUp size={14} />
                      Renew / Upgrade Now
                    </button>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Crown size={18} style={{ color: '#f59e0b' }} />
                      <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Current Plan</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                      {subscriptionData.planName || subscriptionData.plan_name || 'N/A'}
                    </div>
                    {(subscriptionData.isTrial || subscriptionData.is_trial) && (
                      <span style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px', display: 'inline-block' }}>
                        Trial Period{((subscriptionData.trialDays || subscriptionData.trial_days) > 0) ? ` (${subscriptionData.trialDays || subscriptionData.trial_days} days)` : ''}
                      </span>
                    )}
                    {subscriptionData.price && (
                      <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                        ₹{subscriptionData.price.toLocaleString('en-IN')} / {subscriptionData.durationDays || subscriptionData.duration_days || 30} days
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <CheckCircle size={18} style={{ color: (subscriptionData.status === 'ACTIVE' || subscriptionData.status === 'TRIALING') ? '#10b981' : '#ef4444' }} />
                      <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Status</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: (subscriptionData.status === 'ACTIVE' || subscriptionData.status === 'TRIALING') ? '#10b981' : '#ef4444' }}>
                      {subscriptionData.status || 'N/A'}
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Calendar size={18} style={{ color: '#6366f1' }} />
                      <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Valid Until</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                      {(subscriptionData.endDate || subscriptionData.end_date) ? new Date(subscriptionData.endDate || subscriptionData.end_date).toLocaleDateString() : 'N/A'}
                    </div>
                    {(subscriptionData.remainingDays !== null && subscriptionData.remainingDays !== undefined) || (subscriptionData.remaining_days !== null && subscriptionData.remaining_days !== undefined) ? (
                      <span style={{ fontSize: '12px', color: (subscriptionData.remainingDays ?? subscriptionData.remaining_days ?? 0) < 7 ? '#ef4444' : '#6b7280', marginTop: '4px', display: 'inline-block' }}>
                        {subscriptionData.remainingDays ?? subscriptionData.remaining_days ?? 0} days remaining
                      </span>
                    ) : null}
                  </div>

                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Users size={18} style={{ color: '#8b5cf6' }} />
                      <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Employee Seats</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                      {subscriptionData.currentEmployeeCount ?? subscriptionData.current_employees ?? 0}
                      {' / '}
                      {subscriptionData.maxEmployees || subscriptionData.max_employees || 'Unlimited'}
                    </div>
                    {(subscriptionData.remainingSeats ?? subscriptionData.remaining_seats) != null && (
                      <span style={{ fontSize: '12px', color: (subscriptionData.atLimit || subscriptionData.at_limit) ? '#ef4444' : '#6b7280', marginTop: '4px', display: 'inline-block' }}>
                        {(subscriptionData.atLimit || subscriptionData.at_limit)
                          ? 'Seat limit reached'
                          : `${subscriptionData.remainingSeats ?? subscriptionData.remaining_seats} seats remaining`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Plan Features/Modules */}
                {subscriptionData.modules && Array.isArray(subscriptionData.modules) && subscriptionData.modules.length > 0 && (
                  <div style={{ marginTop: '20px', padding: '16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={16} style={{ color: '#0284c7' }} />
                      Plan Features
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {subscriptionData.modules.map((module, index) => (
                        <span
                          key={index}
                          style={{
                            fontSize: '12px',
                            padding: '6px 12px',
                            background: 'white',
                            color: '#0284c7',
                            borderRadius: '16px',
                            fontWeight: 500,
                            border: '1px solid #bae6fd'
                          }}
                        >
                          {module.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plan Description */}
                {subscriptionData.description && (
                  <div style={{ marginTop: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.6', margin: 0 }}>
                      {subscriptionData.description}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 10px' }} />
                <p>Loading subscription details...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade Plan Modal */}
      {showUpgradeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            paddingTop: '28px',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            overflowX: 'visible',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>Upgrade Subscription Plan</h3>
                <p style={{ fontSize: '12px', color: '#6b7280' }}>Choose the perfect plan for your organization</p>
              </div>
              <button
                onClick={() => setShowUpgradeModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <X size={18} style={{ color: '#6b7280' }} />
              </button>
            </div>

            {availablePlans.filter(plan => !plan.isTrial && plan.name?.toLowerCase() !== 'trial').length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}
              >
                {availablePlans
                  .filter(plan => !plan.isTrial && plan.name?.toLowerCase() !== 'trial')
                  .map((plan, index) => {
                    const isCurrentPlan = (subscriptionData?.planName || subscriptionData?.plan_name) === plan.name;
                    const remainingDays = subscriptionData?.remainingDays ?? subscriptionData?.remaining_days ?? 0;
                    const isExpired = remainingDays <= 0;
                    const isExpiringSoon = remainingDays <= 7;
                    const isTrial = subscriptionData?.isTrial || subscriptionData?.is_trial;
                    const canRenewCurrent = isCurrentPlan && (isExpired || isTrial || isExpiringSoon);
                    const isPopular = index === 1 || plan.name?.toLowerCase().includes('pro') || plan.name?.toLowerCase().includes('premium');
                    const isDowngrade = !isCurrentPlan && !isTrial && plan.price < (subscriptionData?.price || 0);

                    return (
                      <div
                        key={plan.planId}
                        style={{
                          position: 'relative',
                          padding: '16px',
                          paddingTop: isCurrentPlan || isPopular ? '32px' : '16px',
                          marginTop: isCurrentPlan || isPopular ? '8px' : '0',
                          border: isCurrentPlan ? '2px solid #10b981' : isPopular ? '2px solid #6366f1' : '1.5px solid #e5e7eb',
                          borderRadius: '8px',
                          background: isCurrentPlan ? '#f0fdf4' : isPopular ? '#f0f9ff' : 'white',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          minWidth: '200px',
                          maxWidth: '100%'
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrentPlan || canRenewCurrent) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrentPlan || canRenewCurrent) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                      >
                        {isPopular && !isCurrentPlan && (
                          <div style={{
                            position: 'absolute',
                            top: '-14px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            padding: '6px 16px',
                            borderRadius: '16px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                            boxShadow: '0 4px 8px rgba(102, 126, 234, 0.4)',
                            border: '2px solid white'
                          }}>
                            Popular
                          </div>
                        )}

                        {isCurrentPlan && (
                          <div style={{
                            position: 'absolute',
                            top: '-14px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#10b981',
                            color: 'white',
                            padding: '6px 16px',
                            borderRadius: '16px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                            boxShadow: '0 4px 8px rgba(16, 185, 129, 0.4)',
                            border: '2px solid white'
                          }}>
                            Current
                          </div>
                        )}

                        {/* Plan Name & Price */}
                        <div style={{ marginBottom: '12px', textAlign: 'center' }}>
                          <h4 style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#111827',
                            marginBottom: '6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {plan.name}
                          </h4>
                          <div style={{ marginBottom: '4px' }}>
                            <span style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>
                              ₹{plan.price?.toLocaleString('en-IN') || '0'}
                            </span>
                            <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '2px' }}>
                              /{plan.durationDays}d
                            </span>
                          </div>
                        </div>

                        {/* Plan Details */}
                        <div style={{ flex: 1, marginBottom: '12px' }}>
                          <div style={{
                            padding: '6px 8px',
                            background: '#f9fafb',
                            borderRadius: '6px',
                            marginBottom: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <Users size={12} style={{ color: '#6366f1', flexShrink: 0 }} />
                            <span style={{ fontSize: '11px', color: '#111827', fontWeight: 500 }}>
                              {plan.maxEmployees || '∞'} Employees
                            </span>
                          </div>

                          <div style={{
                            padding: '6px 8px',
                            background: '#f9fafb',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <Calendar size={12} style={{ color: '#6366f1', flexShrink: 0 }} />
                            <span style={{ fontSize: '11px', color: '#111827', fontWeight: 500 }}>
                              {plan.durationDays} Days
                            </span>
                          </div>

                          {plan.modules && plan.modules.length > 0 && (
                            <div style={{ marginTop: '8px' }}>
                              <div style={{
                                fontSize: '10px',
                                color: '#6b7280',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                                marginBottom: '6px'
                              }}>
                                Features
                              </div>
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '5px',
                                maxHeight: '200px',
                                overflowY: 'auto',
                                paddingRight: '4px',
                                border: '1px solid #f1f5f9',
                                borderRadius: '6px',
                                padding: '8px',
                                backgroundColor: '#fcfcfd'
                              }}>
                                {plan.modules.map((module, idx) => (
                                  <div key={idx} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '11px',
                                    color: '#334155'
                                  }}>
                                    <CheckCircle size={11} style={{ color: '#10b981', flexShrink: 0 }} />
                                    <span style={{ textTransform: 'capitalize', lineHeight: '1.3', fontWeight: 500 }}>
                                      {module.toLowerCase().replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action Button */}
                        <div style={{ marginTop: 'auto' }}>
                          {isCurrentPlan && !canRenewCurrent ? (
                            <button
                              disabled
                              style={{
                                width: '100%',
                                padding: '8px',
                                background: '#e5e7eb',
                                color: '#6b7280',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'not-allowed'
                              }}
                            >
                              Current Plan (Active)
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePlanUpgrade(plan)}
                              disabled={processingPlanId !== null || upgrading}
                              className="hr-btn-primary"
                              style={{
                                width: '100%',
                                padding: '8px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '6px',
                                background: isCurrentPlan ? '#10b981' : isDowngrade ? '#f3f4f6' : isPopular ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : undefined,
                                border: isCurrentPlan ? 'none' : isDowngrade ? '1px solid #cbd5e1' : isPopular ? 'none' : undefined,
                                color: isDowngrade ? '#374151' : undefined
                              }}
                            >
                              {processingPlanId === plan.planId ? (
                                <>
                                  <Loader2 className="animate-spin" size={12} style={{ display: 'inline-block', marginRight: '4px', verticalAlign: 'middle' }} />
                                  Processing...
                                </>
                              ) : upgrading ? (
                                <>
                                  <Loader2 className="animate-spin" size={12} style={{ display: 'inline-block', marginRight: '4px', verticalAlign: 'middle' }} />
                                  Upgrading...
                                </>
                              ) : (
                                  isCurrentPlan ? 'Renew Plan' : isDowngrade ? 'Downgrade Plan' : 'Upgrade Plan'
                                )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>
                <Crown size={32} style={{ margin: '0 auto 12px', color: '#d1d5db' }} />
                <p style={{ fontSize: '14px', fontWeight: 500 }}>No upgrade plans available at the moment.</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>Please contact support for more information.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

