import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, Calendar } from 'lucide-react';
import { validateEmployeeSelfFillToken, submitEmployeeSelfFill } from '../services/api';
import { initialEmployeeSelfFillState } from '../utils/employeeSelfFillUtils';
import './AcceptInvitation.css';

const INDIAN_STATES_DATA = {
  'Andaman and Nicobar Islands': {
    'Port Blair': ['744101', '744102', '744103']
  },
  'Andhra Pradesh': {
    'Visakhapatnam': ['530001', '530002', '530003', '530017', '530020', '530048'],
    'Vijayawada': ['520001', '520002', '520003', '520008', '520010'],
    'Guntur': ['522001', '522002', '522004', '522006'],
    'Tirupati': ['517501', '517502', '517507'],
    'Nellore': ['524001', '524002', '524003'],
    'Kurnool': ['518001', '518002', '518004']
  },
  'Arunachal Pradesh': {
    'Itanagar': ['791111', '791112'],
    'Naharlagun': ['791110']
  },
  'Assam': {
    'Guwahati': ['781001', '781003', '781005', '781012'],
    'Dibrugarh': ['786001', '786003'],
    'Silchar': ['788001', '788005'],
    'Jorhat': ['785001', '785008']
  },
  'Bihar': {
    'Patna': ['800001', '800002', '800003', '800020'],
    'Gaya': ['823001', '823002', '823003'],
    'Muzaffarpur': ['842001', '842002'],
    'Bhagalpur': ['812001', '812002']
  },
  'Chandigarh': {
    'Chandigarh': ['160001', '160002', '160017', '160022', '160036']
  },
  'Chhattisgarh': {
    'Raipur': ['492001', '492002', '492006', '492015'],
    'Bilaspur': ['495001', '495004'],
    'Bhilai': ['490001', '490006', '490020']
  },
  'Dadra and Nagar Haveli and Daman and Diu': {
    'Daman': ['396210', '396220'],
    'Diu': ['362520'],
    'Silvassa': ['396230']
  },
  'Delhi': {
    'New Delhi': ['110001', '110002', '110011', '110020', '110025', '110048', '110062'],
    'Dwarka': ['110075', '110078'],
    'Rohini': ['110085', '110089'],
    'Saket': ['110017'],
    'Karol Bagh': ['110005']
  },
  'Goa': {
    'Panaji': ['403001', '403002'],
    'Margao': ['403601', '403602'],
    'Vasco da Gama': ['403802']
  },
  'Gujarat': {
    'Ahmedabad': ['380001', '380009', '380015', '380051', '380054'],
    'Surat': ['395001', '395003', '395007', '395009'],
    'Vadodara': ['390001', '390005', '390011', '390020'],
    'Rajkot': ['360001', '360005', '360007']
  },
  'Haryana': {
    'Gurugram': ['122001', '122002', '122018', '122102'],
    'Faridabad': ['121001', '121002', '121005'],
    'Panchkula': ['134109', '134112'],
    'Ambala': ['133001', '134003']
  },
  'Himachal Pradesh': {
    'Shimla': ['171001', '171002', '171003'],
    'Dharamshala': ['176215'],
    'Manali': ['175131']
  },
  'Jammu and Kashmir': {
    'Srinagar': ['190001', '190002', '190008'],
    'Jammu': ['180001', '180004', '180012']
  },
  'Jharkhand': {
    'Ranchi': ['834001', '834002', '834005'],
    'Jamshedpur': ['831001', '831002', '831005'],
    'Dhanbad': ['826001', '826004']
  },
  'Karnataka': {
    'Bengaluru': ['560001', '560002', '560004', '560034', '560037', '560100', '560103', '560066', '560076', '560038'],
    'Mysuru': ['570001', '570002', '570010', '570020'],
    'Mangaluru': ['575001', '575003', '575006'],
    'Hubli': ['580020', '580025', '580028']
  },
  'Kerala': {
    'Thiruvananthapuram': ['695001', '695002', '695011'],
    'Kochi': ['682001', '682016', '682025', '682035'],
    'Kozhikode': ['673001', '673004'],
    'Thrissur': ['680001', '680004']
  },
  'Ladakh': {
    'Leh': ['194101']
  },
  'Lakshadweep': {
    'Kavaratti': ['682555']
  },
  'Madhya Pradesh': {
    'Bhopal': ['462001', '462003', '462016', '462022'],
    'Indore': ['452001', '452002', '452010', '452016'],
    'Jabalpur': ['482001', '482002'],
    'Gwalior': ['474001', '474004']
  },
  'Maharashtra': {
    'Mumbai': ['400001', '400002', '400008', '400050', '400097', '400013', '400072', '400088'],
    'Pune': ['411001', '411002', '411004', '411014', '411045', '411057', '411028'],
    'Nagpur': ['440001', '440010', '440015', '440022'],
    'Thane': ['400601', '400602', '400607', '400615']
  },
  'Manipur': {
    'Imphal': ['795001', '795004']
  },
  'Megahalaya': {
    'Shillong': ['793001', '793003']
  },
  'Mizoram': {
    'Aizawl': ['796001', '796005']
  },
  'Nagaland': {
    'Kohima': ['797001'],
    'Dimapur': ['797112']
  },
  'Odisha': {
    'Bhubaneswar': ['751001', '751003', '751009', '751024'],
    'Cuttack': ['753001', '753003', '753008'],
    'Rourkela': ['769001', '769004']
  },
  'Puducherry': {
    'Puducherry': ['605001', '605003', '605008']
  },
  'Punjab': {
    'Ludhiana': ['141001', '141003', '141008'],
    'Amritsar': ['143001', '143006'],
    'Jalandhar': ['144001', '144003'],
    'Patiala': ['147001', '147004']
  },
  'Rajasthan': {
    'Jaipur': ['302001', '302002', '302015', '302020', '302033'],
    'Jodhpur': ['342001', '342003', '342008'],
    'Udaipur': ['313001', '313004'],
    'Kota': ['324001', '324005']
  },
  'Sikkim': {
    'Gangtok': ['737101', '737102']
  },
  'Tamil Nadu': {
    'Chennai': ['600001', '600002', '600004', '600028', '600096', '600040', '600113', '600018'],
    'Coimbatore': ['641001', '641002', '641018', '641046'],
    'Madurai': ['625001', '625002', '625020'],
    'Trichy': ['620001', '620015', '620018']
  },
  'Telangana': {
    'Hyderabad': ['500001', '500002', '500003', '500032', '500081', '500090', '500016', '500019', '500072', '500049'],
    'Warangal': ['506001', '506002', '506007'],
    'Nizamabad': ['503001', '503003']
  },
  'Tripura': {
    'Agartala': ['799001', '799002']
  },
  'Uttar Pradesh': {
    'Lucknow': ['226001', '226002', '226010', '226016', '226024'],
    'Noida': ['201301', '201303', '201307', '201313'],
    'Kanpur': ['208001', '208002', '208005'],
    'Ghaziabad': ['201001', '201002', '201010']
  },
  'Uttarakhand': {
    'Dehradun': ['248001', '248003', '248005'],
    'Haridwar': ['249401', '249408'],
    'Nainital': ['263001']
  },
  'West Bengal': {
    'Kolkata': ['700001', '700002', '700009', '700020', '700091', '700056', '700156'],
    'Howrah': ['711101', '711102', '711104'],
    'Durgapur': ['713201', '713203'],
    'Siliguri': ['734001', '734005']
  }
};

const US_STATES_DATA = {
  'California': {
    'Los Angeles': ['90001', '90002', '90003', '90004', '90012'],
    'San Francisco': ['94101', '94102', '94103', '94105'],
    'San Diego': ['92101', '92102', '92103'],
    'San Jose': ['95101', '95110', '95112']
  },
  'New York': {
    'New York City': ['10001', '10002', '10003', '10004', '10011', '10018'],
    'Buffalo': ['14201', '14202', '14204'],
    'Rochester': ['14602', '14604']
  },
  'Texas': {
    'Houston': ['77001', '77002', '77003', '77005'],
    'Austin': ['78701', '78702', '78704', '78705'],
    'Dallas': ['75201', '75202', '75204'],
    'San Antonio': ['78201', '78202', '78205']
  },
  'Florida': {
    'Miami': ['33101', '33109', '33125'],
    'Orlando': ['32801', '32803', '32805'],
    'Tampa': ['33601', '33602', '33606']
  },
  'Illinois': {
    'Chicago': ['60601', '60602', '60603', '60605', '60611'],
    'Springfield': ['62701', '62702']
  }
};

const DOC_FIELDS = [
  { label: 'Appointment Letter', field: 'appointmentLetter' },
  { label: 'Salary Slips', field: 'salarySlips' },
  { label: 'Relieving Letter', field: 'relivingLetter' },
  { label: 'Experience Letter', field: 'experienceLetter' },
];

const SECTIONS = [
  { id: 'personal', label: 'Personal' },
  { id: 'address', label: 'Address & Role' },
  { id: 'work', label: 'IDs & Skills' },
  { id: 'documents', label: 'Documents' },
];

export default function EmployeeSelfFill() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [validating, setValidating] = useState(!!token);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orgName, setOrgName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ ...initialEmployeeSelfFillState });
  const [activeSection, setActiveSection] = useState('personal');
  const [zipSearchQuery, setZipSearchQuery] = useState('');
  const fileRefs = useRef({});

  useEffect(() => {
    if (!token) {
      setError('Invalid link. No token found.');
      setValidating(false);
      return;
    }
    const validate = async () => {
      try {
        setValidating(true);
        const res = await validateEmployeeSelfFillToken(token);
        if (res.status === 'COMPLETED') {
          setSubmitted(true);
          setOrgName(res.message || 'your organization');
          return;
        }
        if (res.status === 'EXPIRED') {
          setError('This link has expired. Please contact HR for a new link.');
          return;
        }
        setOrgName(res.message || 'your organization');
        setInviteEmail(res.email || '');
        setFormData((prev) => ({ ...prev, email: res.email || '' }));
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Invalid or expired link.');
      } finally {
        setValidating(false);
      }
    };
    validate();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleFileChange = (e, field) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, [field]: file }));
  };

  const validateSection = (section = activeSection) => {
    if (section === 'personal') {
      if (!formData.firstName?.trim()) return 'First name is required.';
      if (!formData.lastName?.trim()) return 'Last name is required.';
      if (!formData.phoneNumber?.trim()) return 'Mobile number is required.';
      if (!formData.email?.trim()) return 'Email is required.';
      if (!formData.dateOfBirth) return 'Date of birth is required.';
    }

    if (section === 'address') {
      const stateVal = formData.state === 'Other' ? formData.customState : formData.state;
      if (!stateVal?.trim()) return 'State is required.';

      const cityVal = formData.city === 'Other' ? formData.customCity : formData.city;
      if (!cityVal?.trim()) return 'City is required.';

      const zipVal = formData.zipCode === 'Other' ? formData.customZipCode : formData.zipCode;
      if (!zipVal?.trim()) return 'ZIP / Postal Code is required.';
    }

    return '';
  };

  const validateForm = () => {
    return validateSection('personal') || validateSection('address');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activeSection !== 'documents') {
      const idx = SECTIONS.findIndex((s) => s.id === activeSection);
      if (idx < SECTIONS.length - 1) {
        const err = validateSection(activeSection);
        if (err) {
          setError(err);
          return;
        }
        setError('');
        setActiveSection(SECTIONS[idx + 1].id);
      }
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError('');
    
    // Format custom inputs before submitting
    const payload = { ...formData };
    if (payload.state === 'Other') {
      payload.state = payload.customState || '';
    }
    if (payload.city === 'Other') {
      payload.city = payload.customCity || '';
    }
    if (payload.zipCode === 'Other') {
      payload.zipCode = payload.customZipCode || '';
    }
    
    // Clean up helper attributes
    delete payload.customState;
    delete payload.customCity;
    delete payload.customZipCode;
    delete payload._dobType;

    try {
      await submitEmployeeSelfFill(token, payload);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getCountryCode = (nationality) => {
    switch (nationality) {
      case 'Indian': return '+91';
      case 'American': return '+1';
      case 'British': return '+44';
      case 'Canadian': return '+1';
      case 'Australian': return '+61';
      case 'Singaporean': return '+65';
      case 'Emirati': return '+971';
      case 'German': return '+49';
      case 'French': return '+33';
      case 'Japanese': return '+81';
      default: return '';
    }
  };

  const countryCode = getCountryCode(formData.nationality);

  if (validating) {
    return (
      <div className="invite-page-wrapper">
        <div style={{ textAlign: 'center' }}>
          <div className="invite-spinner-dark" />
          <p style={{ color: '#888', fontSize: '14px', fontWeight: 500 }}>Verifying link...</p>
        </div>
      </div>
    );
  }

  if (!token || (error && !inviteEmail && !submitted)) {
    return (
      <div className="invite-page-wrapper">
        <div className="invite-card-new">
          <div className="invite-brand">
            <div className="invite-brand-dot" />
            <span className="invite-brand-name">Pragva HRMS</span>
          </div>
          <h1>Link unavailable</h1>
          <p className="invite-sub">{error || 'This link is not valid.'}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="invite-page-wrapper">
        <div className="invite-card-new">
          <div className="invite-brand">
            <div className="invite-brand-dot" />
            <span className="invite-brand-name">Pragva HRMS</span>
          </div>
          <h1>Thank you</h1>
          <p className="invite-sub">
            Your details have been submitted to {orgName}. HR will review your information and complete onboarding.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-page-wrapper" style={{ alignItems: 'flex-start', paddingTop: 24, paddingBottom: 48 }}>
      <div className="invite-card-new" style={{ maxWidth: 920, width: '100%' }}>
        <div className="invite-brand">
          <div className="invite-brand-dot" />
          <span className="invite-brand-name">Pragva HRMS</span>
        </div>
        <h1>Complete your employee details</h1>
        <p className="invite-sub">
          {orgName} has asked you to fill in your details before onboarding is completed.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: activeSection === s.id ? '1px solid #2563eb' : '1px solid #e5e7eb',
                background: activeSection === s.id ? '#eff6ff' : '#fff',
                color: activeSection === s.id ? '#1d4ed8' : '#374151',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
          }
        }}>
          {error && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 14 }}>
              {error}
            </div>
          )}

          {activeSection === 'personal' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              <Field label="First Name *" name="firstName" value={formData.firstName} onChange={handleChange} />
              <Field label="Last Name *" name="lastName" value={formData.lastName} onChange={handleChange} />
              <div>
                <label style={labelStyle}>Mobile Number *</label>
                <div style={{ position: 'relative' }}>
                  {countryCode && <span style={{ position: 'absolute', left: 10, top: 10, fontSize: 13, color: '#6b7280' }}>{countryCode}</span>}
                  <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} maxLength={10} style={{ ...inputStyle, paddingLeft: countryCode ? 44 : 12 }} />
                </div>
              </div>
              <Field label="Email *" name="email" type="email" value={formData.email} onChange={handleChange} readOnly />
              <Field label="Date of Birth *" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} />
              <SelectField label="Marital Status" name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} options={['', 'Single', 'Married', 'Divorced']} />
              <SelectField label="Gender" name="gender" value={formData.gender} onChange={handleChange} options={['', 'Male', 'Female', 'Other', 'Prefer not to say']} />
              {formData.gender === 'Other' && (
                <Field label="Specify gender" name="otherGender" value={formData.otherGender} onChange={handleChange} />
              )}
              <SelectField label="Nationality" name="nationality" value={formData.nationality} onChange={handleChange}
                options={['', 'Indian', 'American', 'British', 'Canadian', 'Australian', 'Singaporean', 'Emirati', 'German', 'French', 'Japanese', 'Other']} />
              {formData.nationality === 'Other' && (
                <Field label="Specify nationality" name="otherNationality" value={formData.otherNationality} onChange={handleChange} />
              )}
              <Field label="Emergency Contact" name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} />
              <Field label="Emergency Phone" name="emergencyPhone" value={formData.emergencyPhone} onChange={handleChange} />
              <Field label="Blood Group" name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} />
            </div>
          )}

          {activeSection === 'address' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              <Field label="Job Title / Designation" name="designation" value={formData.designation} onChange={handleChange} />
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Address" name="address" value={formData.address} onChange={handleChange} />
              </div>
              {/* Country Dropdown */}
              <SelectField 
                label="Country *" 
                name="country" 
                value={formData.country || (formData.nationality === 'American' ? 'United States' : 'India')} 
                onChange={(e) => {
                  const val = e.target.value;
                  const mappedNationality = val === 'United States' ? 'American' : val === 'India' ? 'Indian' : 'Other';
                  setFormData(prev => ({ 
                    ...prev, 
                    country: val,
                    nationality: mappedNationality,
                    state: '', 
                    city: '', 
                    zipCode: ''
                  }));
                }} 
                options={['', 'India', 'United States', 'Other']} 
              />
              {/* State Dropdown */}
              <SelectField 
                label="State *" 
                name="state" 
                value={formData.state || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => ({ 
                    ...prev, 
                    state: val, 
                    city: '', // Reset child selections
                    zipCode: ''
                  }));
                }} 
                options={['', ...Object.keys((formData.country === 'United States' || formData.nationality === 'American') ? US_STATES_DATA : INDIAN_STATES_DATA), 'Other']} 
              />
              
              {formData.state === 'Other' && (
                <Field 
                  label="Specify State *" 
                  name="customState" 
                  value={formData.customState || ''} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, customState: val }));
                  }} 
                />
              )}

              {/* City Dropdown */}
              {formData.state && formData.state !== 'Other' ? (
                <SelectField 
                  label="City *" 
                  name="city" 
                  value={formData.city || ''} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ 
                      ...prev, 
                      city: val,
                      zipCode: '' // Reset child selection
                    }));
                  }} 
                  options={['', ...Object.keys(((formData.country === 'United States' || formData.nationality === 'American') ? US_STATES_DATA : INDIAN_STATES_DATA)[formData.state] || {}), 'Other']} 
                />
              ) : (
                <Field 
                  label="City *" 
                  name="city" 
                  value={formData.city || ''} 
                  onChange={handleChange} 
                  placeholder={formData.state === 'Other' ? 'Type city name' : 'Select state first'}
                  readOnly={!formData.state}
                />
              )}

              {formData.city === 'Other' && (
                <Field 
                  label="Specify City *" 
                  name="customCity" 
                  value={formData.customCity || ''} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, customCity: val }));
                  }} 
                />
              )}

              {/* ZIP Code Dropdown & Search Field */}
              {formData.state && formData.state !== 'Other' && formData.city && formData.city !== 'Other' ? (
                <div>
                  <label style={labelStyle}>ZIP / Postal Code *</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Inline Search Input */}
                    <input 
                      type="text" 
                      placeholder="Search ZIP code..." 
                      value={zipSearchQuery}
                      onChange={(e) => setZipSearchQuery(e.target.value)}
                      style={{ ...inputStyle, height: '34px', fontSize: '13px', background: '#f9fafb' }}
                    />
                    {/* Native Select Picker */}
                    <select 
                      name="zipCode" 
                      value={formData.zipCode || ''} 
                      onChange={handleChange} 
                      style={inputStyle}
                    >
                      <option value="">Select ZIP</option>
                      {/* Render top 5 options + filtered options matching search */}
                      {(() => {
                        const activeDataset = formData.nationality === 'American' ? US_STATES_DATA : INDIAN_STATES_DATA;
                        const allZips = activeDataset[formData.state]?.[formData.city] || [];
                        const query = zipSearchQuery.trim().toLowerCase();
                        
                        // If there is a search query, show all matching. If empty, show first 5.
                        const filtered = query
                          ? allZips.filter(zip => zip.toLowerCase().includes(query))
                          : allZips.slice(0, 5);

                        return (
                          <>
                            {filtered.map(zip => (
                              <option key={zip} value={zip}>{zip}</option>
                            ))}
                            {/* Always add 'Other' so they can key in manually */}
                            <option value="Other">Other (Type manually)</option>
                          </>
                        );
                      })()}
                    </select>
                  </div>
                </div>
              ) : (
                <Field 
                  label="ZIP / Postal Code *" 
                  name="zipCode" 
                  value={formData.zipCode || ''} 
                  onChange={handleChange} 
                  placeholder={formData.city === 'Other' ? 'Type ZIP code' : 'Select city first'}
                  readOnly={!formData.city}
                />
              )}

              {formData.zipCode === 'Other' && (
                <Field 
                  label="Specify ZIP Code *" 
                  name="customZipCode" 
                  value={formData.customZipCode || ''} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, customZipCode: val }));
                  }} 
                />
              )}
            </div>
          )}

          {activeSection === 'work' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              <Field label="PAN Number" name="panNumber" value={formData.panNumber} onChange={handleChange} />
              <Field label="UAN Number" name="uanNumber" value={formData.uanNumber} onChange={handleChange} />
              <Field label="Aadhaar Number" name="aadhaarNumber" value={formData.aadhaarNumber} onChange={handleChange} maxLength={12} />
              <Field label="Highest Qualification" name="highestQualification" value={formData.highestQualification} onChange={handleChange} />
              <Field label="Primary Skills" name="primarySkills" value={formData.primarySkills} onChange={handleChange} />
              <Field label="Secondary Skills" name="secondarySkills" value={formData.secondarySkills} onChange={handleChange} />
              <Field label="Experience (years)" name="experienceYears" value={formData.experienceYears} onChange={handleChange} />
            </div>
          )}

          {activeSection === 'documents' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {DOC_FIELDS.map((doc) => (
                <div
                  key={doc.field}
                  onClick={() => fileRefs.current[doc.field]?.click()}
                  style={{
                    border: '1px dashed #d1d5db',
                    borderRadius: 10,
                    padding: 16,
                    textAlign: 'center',
                    cursor: 'pointer',
                    minHeight: 120,
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, textAlign: 'left' }}>{doc.label}</p>
                  <Upload size={20} style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                  <p style={{ fontSize: 12, color: '#6b7280' }}>PDF or JPG</p>
                  <input
                    type="file"
                    ref={(el) => { fileRefs.current[doc.field] = el; }}
                    accept=".pdf,.jpg,.jpeg"
                    className="hidden"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileChange(e, doc.field)}
                  />
                  {formData[doc.field] && (
                    <p style={{ fontSize: 12, color: '#15803d', marginTop: 8 }}>{formData[doc.field].name}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
            <div>
              {activeSection !== 'personal' && (
                <button
                  type="button"
                  className="invite-btn"
                  style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const idx = SECTIONS.findIndex((s) => s.id === activeSection);
                    if (idx > 0) setActiveSection(SECTIONS[idx - 1].id);
                  }}
                >
                  Previous
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {activeSection !== 'documents' ? (
                <button
                  type="button"
                  className="invite-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const validationError = validateSection(activeSection);
                    if (validationError) {
                      setError(validationError);
                      return;
                    }
                    setError('');
                    const idx = SECTIONS.findIndex((s) => s.id === activeSection);
                    if (idx < SECTIONS.length - 1) setActiveSection(SECTIONS[idx + 1].id);
                  }}
                >
                  Next
                </button>
              ) : (
                <button type="submit" className="invite-btn" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit details'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 };
const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 14,
  boxSizing: 'border-box',
};

function Field({ label, name, value, onChange, type = 'text', readOnly, maxLength }) {
  const inputRef = useRef(null);
  
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
            }
          }}
          readOnly={readOnly}
          maxLength={maxLength}
          style={{ 
            ...inputStyle, 
            background: readOnly ? '#f3f4f6' : '#fff',
            paddingRight: type === 'date' ? '40px' : '12px' 
          }}
        />
        {type === 'date' && !readOnly && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (inputRef.current && typeof inputRef.current.showPicker === 'function') {
                try { inputRef.current.showPicker(); } catch (err) {}
              }
            }}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              color: '#4b5563'
            }}
          >
            <Calendar size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select name={name} value={value} onChange={onChange} style={inputStyle}>
        {options.map((opt) => (
          <option key={opt || 'empty'} value={opt}>{opt || 'Select'}</option>
        ))}
      </select>
    </div>
  );
}
