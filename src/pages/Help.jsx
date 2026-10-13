import React, { useState } from 'react';
import {
  HelpCircle, Search, ChevronDown, ChevronUp, Mail, Phone, Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import './Help.css';

export default function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState({});
  const [activeCategory, setActiveCategory] = useState('Getting Started');
  
  const { sessionType, adminUser, getCurrentUser, hasModule: authHasModule } = useAuth();
  const hasModule = authHasModule || (() => true);
  const currentUser = getCurrentUser() || {};
  
  // Role checks
  const isAdmin = sessionType === 'admin' || !!adminUser || (currentUser.roles && currentUser.roles.some(r => String(r).trim().toUpperCase() === 'ADMIN'));
  const isHR = currentUser.roles && currentUser.roles.some(r => String(r).trim().toUpperCase() === 'HR');
  
  const isManager = (() => {
    if (currentUser.roles && Array.isArray(currentUser.roles)) {
      return currentUser.roles.some(role => String(role).trim().toUpperCase() === 'MANAGER');
    }
    const roleValue = currentUser.employeeRoleName || currentUser.role?.name || currentUser.role;
    return String(roleValue).trim().toUpperCase() === 'MANAGER';
  })();

  const getFAQCategories = () => {
    const categories = {
      'Getting Started': [
        {
          question: 'How do I access my dashboard?',
          answer: 'After logging in, you will be automatically redirected to your dashboard. You can also access it by clicking "Dashboard" in the sidebar menu.'
        },
        {
          question: 'How do I update my profile information?',
          answer: 'Click on your profile picture in the top right corner and select "My Profile". From there, you can update your personal information, contact details, and profile picture.'
        },
        {
          question: 'How do I reset my password?',
          answer: 'Click "Forgot Password?" on the login page, enter your email address, and follow the instructions sent to your email to reset your password.'
        }
      ]
    };

    if (hasModule('LEAVE_MANAGEMENT')) {
      categories['Leave Management'] = [
        {
          question: 'How do I apply for leave?',
          answer: 'Go to "My Leaves" in the Time Office section, click "Apply Leave", select the leave type, dates, and provide a reason. Your request will be sent to your reporting manager for approval.'
        },
        {
          question: 'How can I check my leave balance?',
          answer: 'Your leave balance is displayed on your dashboard and in the "My Leaves" section. It shows available days for each leave type.'
        },
        {
          question: 'What happens if my leave is rejected?',
          answer: 'You will receive a notification with the rejection reason. You can resubmit a modified request or contact your manager for clarification.'
        }
      ];
    }

    if (hasModule('TIMESHEETS') || hasModule('ATTENDANCE')) {
      categories['Attendance & Timesheet'] = [
        {
          question: 'How do I mark my attendance?',
          answer: 'Use the "Mark Attendance" feature in the Attendance section. Clock in when you start work and clock out when you finish. Some organizations use biometric systems that automatically sync.'
        },
        {
          question: 'How do I submit my timesheet?',
          answer: 'Go to "Timesheets" under Time Office, add your daily work entries with project details and hours, then submit for approval at the end of the week/period.'
        },
        {
          question: 'Can I edit my attendance if I forgot to clock in?',
          answer: 'Contact your HR or manager to request an attendance correction. They can manually adjust your attendance records if needed.'
        }
      ];
    }

    if (hasModule('ATTENDANCE')) {
      categories['Work From Home (WFH)'] = [
        {
          question: 'How do I submit a WFH request?',
          answer: 'Navigate to "WFH" in the Time Office, click "Request WFH", select the desired start date, end date, and reason, then submit. Your manager will review and approve it.'
        },
        {
          question: 'Can I apply for WFH for multiple consecutive days?',
          answer: 'Yes, you can apply for multiple days by selecting the date range. Some company policies limit the number of WFH days per month, so check with your manager.'
        }
      ];
    }

    const hasAssetModule = hasModule('ASSETS') || hasModule('ASSET_MANAGEMENT');
    if (hasAssetModule) {
      categories['Asset Management'] = [
        {
          question: 'How do I request a company asset (e.g., Laptop)?',
          answer: 'Go to "Asset Management", select "Request Asset", choose the asset category needed (hardware/software), and describe the business justification. It will be sent to Admin for assignment.'
        },
        {
          question: 'What do I do if my assigned laptop needs repair?',
          answer: 'In the "Asset Management" section, locate your assigned asset and click "Report Issue/Repair". Describe the hardware defect in detail to alert the IT support team.'
        }
      ];
    }

    const hasNoticeModule = hasModule('NOTICES') || hasModule('NOTICE_BOARD');
    if (hasNoticeModule) {
      categories['Notice Board'] = [
        {
          question: 'Where can I see official company notices?',
          answer: 'Go to the "Notice Board" section from the sidebar. Important updates, policies, and holiday calendar announcements from HR and Admin will be pinned there.'
        }
      ];
    }

    if (hasModule('EXPENSES')) {
      categories['Expense Management'] = [
        {
          question: 'How do I submit an expense claim?',
          answer: 'Navigate to "My Expenses", click "Submit Expense", fill in the details, attach receipts, and submit. Your claim will go through the approval workflow (Manager → Finance → Final Approval).'
        },
        {
          question: 'What documents do I need for expense claims?',
          answer: 'You need valid receipts or invoices for all expenses. Scan or photograph them and attach during submission. Original receipts may need to be submitted to finance.'
        }
      ];
    }

    categories['Role & Access Control'] = [
      {
        question: 'Who manages employee roles and permissions?',
        answer: 'HR and Administrators manage system roles. Access control settings (Admin, HR, Manager, and Employee levels) are assigned based on organizational hierarchy to ensure secure access to data.'
      }
    ];

    // Role-specific Admin/HR category
    if (isAdmin || isHR) {
      categories['Admin & HR Guide'] = [
        {
          question: 'How do I configure employee leave types and policies?',
          answer: 'Go to Admin Portal → Leaves → Leave Settings/Types to add new leave categories, define accrual rules, and set carry-forward policies.'
        },
        {
          question: 'How do I publish official announcements?',
          answer: 'Navigate to the Notices section as Admin or HR, click "Create Notice", enter the title and description, choose targeted departments, and publish it.'
        },
        {
          question: 'How do I manage and verify employee documents?',
          answer: 'Go to the employee profile documents tab, review pending files (like Aadhar/PAN cards), and click "Verify" or "Reject" with comments.'
        }
      ];
    }

    // Role-specific Manager category
    if (isManager || isAdmin || isHR) {
      categories['Manager Portal Guide'] = [
        {
          question: 'How do I approve or reject timesheets for my team?',
          answer: 'Access the Manager Portal page, navigate to the Approvals or Timesheets tab. You can review individual timesheet entries, check descriptions/billability, and click Approve or Reject.'
        },
        {
          question: 'How do I act on leave requests from team members?',
          answer: 'Go to the Approvals section on the Manager Portal. You will see a list of pending Leave and WFH requests. Click Approve or Reject (you can provide comments if rejecting).'
        }
      ];
    }

    categories['Technical Issues'] = [
      {
        question: 'I cannot log in to my account',
        answer: 'Ensure you are using the correct username and password. If you\'ve forgotten your password, use "Forgot Password?" on the login page. If issues persist, contact IT support.'
      },
      {
        question: 'The application is slow or not loading',
        answer: 'Try clearing your browser cache, using a different browser, or checking your internet connection. If the problem continues, report it to IT support.'
      }
    ];

    return categories;
  };

  const faqCategories = getFAQCategories();

  const toggleFaq = (category, index) => {
    const key = `${category}-${index}`;
    setExpandedFaq(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredFaqs = searchQuery
    ? Object.entries(faqCategories).reduce((acc, [category, faqs]) => {
        const filtered = faqs.filter(
          faq =>
            faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (filtered.length > 0) acc[category] = filtered;
        return acc;
        // eslint-disable-next-line
      }, {})
    : { [activeCategory]: faqCategories[activeCategory] || [] };

  return (
    <div className="main-content help-page">
      <Header
        title="Help & Support"
        subtitle="Find answers to your questions and get assistance"
      />

      <div className="page-content" style={{ padding: '16px' }}>
        {/* Hero Section */}
        <div className="help-hero" style={{ padding: '32px 20px', marginBottom: '20px', borderRadius: '16px' }}>
          <div className="help-hero-content">
            <HelpCircle size={40} className="help-hero-icon" style={{ marginBottom: '12px' }} />
            <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>How can we help you today?</h1>
            <p style={{ fontSize: '15px', marginBottom: '20px' }}>Search our knowledge base or contact support</p>
            
            <div className="help-search">
              <span className="help-search-icon"><Search size={20} /></span>
              <input
                type="text"
                placeholder="Search for help articles, FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search help"
              />
            </div>
          </div>
        </div>

        <div className="help-container" style={{ maxWidth: '100%', padding: '0 0 20px 0' }}>
          {/* FAQs */}
          <div className="help-section" style={{ padding: '24px', marginBottom: '20px' }}>
            <h2 className="help-section-title" style={{ fontSize: '20px', marginBottom: '16px' }}>Frequently Asked Questions</h2>

            {!searchQuery && (
              <div className="faq-categories" style={{ marginBottom: '16px', paddingBottom: '16px' }}>
                {Object.keys(faqCategories).map((category) => (
                  <button
                    key={category}
                    className={`faq-category-btn ${activeCategory === category ? 'active' : ''}`}
                    onClick={() => {
                      setActiveCategory(category);
                      setExpandedFaq({});
                    }}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}

            <div className="faq-list">
              {Object.entries(filteredFaqs).map(([category, faqs]) => (
                <div key={category} className="faq-category-section" style={{ marginBottom: '12px' }}>
                  {searchQuery && <h3 className="faq-category-title" style={{ fontSize: '16px', marginBottom: '12px' }}>{category}</h3>}
                  {faqs.map((faq, index) => {
                    const key = `${category}-${index}`;
                    const isExpanded = expandedFaq[key];
                    return (
                      <div key={index} className="faq-item">
                        <button
                          className="faq-question"
                          onClick={() => toggleFaq(category, index)}
                          style={{ padding: '12px 16px', fontSize: '14px' }}
                        >
                          <span>{faq.question}</span>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {isExpanded && (
                          <div className="faq-answer" style={{ padding: '0 16px 16px', fontSize: '13px' }}>
                            <p>{faq.answer}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {searchQuery && Object.keys(filteredFaqs).length === 0 && (
              <div className="no-results" style={{ padding: '30px 20px' }}>
                <HelpCircle size={36} />
                <p>No results found for "{searchQuery}"</p>
                <p className="no-results-sub">Try different keywords or contact support below</p>
              </div>
            )}
          </div>

          {/* Contact Support */}
          <div className="help-section" style={{ padding: '24px' }}>
            <h2 className="help-section-title" style={{ fontSize: '20px', marginBottom: '16px' }}>Contact Us</h2>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px'
            }}>
              {/* Email Support */}
              <div className="contact-option-card" style={{ padding: '20px' }}>
                <Mail size={28} style={{ marginBottom: '8px' }} />
                <h4 style={{ fontSize: '15px', marginBottom: '6px' }}>Email Support</h4>
                <p style={{ fontWeight: 'bold', color: '#6366f1', fontSize: '15px', margin: '0 0 4px 0' }}>info@pragva.in</p>
                <span className="response-time">Response within 24 hours</span>
              </div>

              {/* Phone Support */}
              <div className="contact-option-card" style={{ padding: '20px' }}>
                <Phone size={28} style={{ marginBottom: '8px' }} />
                <h4 style={{ fontSize: '15px', marginBottom: '6px' }}>Phone Support</h4>
                <p style={{ fontWeight: 'bold', fontSize: '15px', margin: '0 0 4px 0' }}>+91 8686260302</p>
                <span className="response-time">Mon-Fri, 9AM - 6PM IST</span>
              </div>

              {/* Support Hours */}
              <div className="contact-option-card" style={{ padding: '20px' }}>
                <Clock size={28} style={{ marginBottom: '8px' }} />
                <h4 style={{ fontSize: '15px', marginBottom: '6px' }}>Support Hours</h4>
                <p style={{ fontWeight: 'bold', fontSize: '15px', margin: '0 0 4px 0' }}>Monday - Friday</p>
                <span className="response-time">9:00 AM - 6:00 PM IST</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
