import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  Calendar,
  FileText,
  UserCheck,
  BarChart3,
  MessageSquare,
  Settings,
  ChevronRight,
  Shield,
  Zap,
  PlusCircle,
  Trophy,
  BookOpen,
  Lightbulb,
  Megaphone,
  Globe,
  Brain,
  Check,
  Star,
  Crown,
  Building,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  Play,
  Sparkles,
  TrendingUp,
  Award,
  HeartHandshake,
  Rocket,
  Target,
  Quote,
  ChevronDown,
  Menu as MenuIcon,
  X,
  Search,
  Bell,
  CheckCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoImage from '../assets/Logo.png';
import './LandingPage.css';
import { marketingAPI } from '../services/api';
import toast from 'react-hot-toast';

function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [activeHeroImage, setActiveHeroImage] = useState(0);
  const [activeLearningCategory, setActiveLearningCategory] = useState('forYou');
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [demoForm, setDemoForm] = useState({
    fullName: '',
    workEmail: '',
    phoneCode: '+91',
    phoneNumber: '',
    companyName: '',
    employeeCount: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const phoneCountryOptions = [
    { code: '+91', label: 'India (+91)', format: 'XXXXX-XXXXX' },
    { code: '+1', label: 'United States (+1)', format: '(XXX) XXX-XXXX' },
    { code: '+44', label: 'United Kingdom (+44)', format: 'XXXX XXXX XXXX' },
    { code: '+61', label: 'Australia (+61)', format: 'XXXX XXX XXX' },
    { code: '+971', label: 'UAE (+971)', format: 'XX XXX XXXX' },
    { code: '+65', label: 'Singapore (+65)', format: 'XXXX XXXX' },
    { code: '+60', label: 'Malaysia (+60)', format: 'XX-XXX XXXX' },
    { code: '+63', label: 'Philippines (+63)', format: 'XXXX XXX XXXX' },
    { code: '+62', label: 'Indonesia (+62)', format: 'XXX-XXX-XXXX' },
    { code: '+81', label: 'Japan (+81)', format: 'XX-XXXX-XXXX' },
    { code: '+49', label: 'Germany (+49)', format: 'XXXX XXXXXXX' },
    { code: '+33', label: 'France (+33)', format: 'X XX XX XX XX' },
    { code: '+39', label: 'Italy (+39)', format: 'XXX XXXX XXX' },
    { code: '+7', label: 'Russia (+7)', format: 'XXX XXX-XX-XX' },
    { code: '+55', label: 'Brazil (+55)', format: '(XX) XXXXX-XXXX' },
    { code: '+34', label: 'Spain (+34)', format: 'XXX XXX XXX' },
    { code: '+27', label: 'South Africa (+27)', format: 'XX XXX XXXX' },
    { code: '+234', label: 'Nigeria (+234)', format: 'XXX XXX XXXX' }
  ];

  const getPhoneFormat = (code) => phoneCountryOptions.find(option => option.code === code)?.format;

  const applyPhoneFormat = (rawValue, format) => {
    if (!format) return rawValue;
    const digits = String(rawValue || '').replace(/\D/g, '');
    let result = '';
    let digitIndex = 0;
    for (let i = 0; i < format.length; i += 1) {
      const char = format[i];
      if (char.toUpperCase() === 'X') {
        if (digitIndex >= digits.length) break;
        result += digits[digitIndex];
        digitIndex += 1;
      } else {
        if (digitIndex >= digits.length) break;
        result += char;
      }
    }
    return result;
  };

  const heroImages = [
    {
      src: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=500&fit=crop",
      alt: "HR Team collaboration"
    },
    {
      src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=500&fit=crop",
      alt: "Team meeting in modern office"
    },
    {
      src: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=500&fit=crop",
      alt: "Business professionals discussing"
    },
    {
      src: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&h=500&fit=crop",
      alt: "Team working together"
    }
  ];

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-rotate hero images
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveHeroImage(prev => (prev + 1) % heroImages.length);
    }, 4000); // Change image every 4 seconds

    return () => clearInterval(interval);
  }, [heroImages.length]);

  const employeeFeatures = [
    { icon: Clock, title: "Time Tracking", desc: "Log timesheet and extra hours" },
    { icon: Calendar, title: "Leave Management", desc: "Request and track leave applications" },
    { icon: UserCheck, title: "Profile Management", desc: "Update personal information" },
    { icon: Trophy, title: "Achievements", desc: "Submit and track accomplishments" },
    { icon: MessageSquare, title: "AI Voice Agent", desc: "Enhance team communication and collaboration skills" }
  ];

  const hrFeatures = [
    { icon: Users, title: "Employee Management", desc: "Manage employee data and profiles" },
    { icon: Calendar, title: "Leave Approvals", desc: "Review and approve leave requests" },
    { icon: BarChart3, title: "Analytics Dashboard", desc: "Monitor performance and metrics" },
    { icon: MessageSquare, title: "Notice Board", desc: "Publish announcements" },
    { icon: Settings, title: "Asset Tracking", desc: "Manage company assets" }
  ];

  const benefits = [
    { icon: Zap, title: "Lightning Fast", desc: "Sub-second response times for seamless operations", gradient: "from-amber-500 to-orange-600" },
    { icon: Shield, title: "Enterprise Security", desc: "Bank-level encryption with 99.9% uptime", gradient: "from-emerald-500 to-teal-600" },
    { icon: Globe, title: "Access Anywhere", desc: "Cloud-native across all your devices", gradient: "from-blue-500 to-indigo-600" },
    { icon: Brain, title: "AI-Powered", desc: "Smart analytics for data-driven decisions", gradient: "from-purple-500 to-pink-600" },
    { icon: Users, title: "Employee First", desc: "Self-service portal that empowers teams", gradient: "from-rose-500 to-red-600" },
    { icon: Settings, title: "Fully Customizable", desc: "Adapt to your unique workflows", gradient: "from-cyan-500 to-blue-600" }
  ];

  const keyFeatures = [
    { icon: Calendar, title: "Leave & Holiday Management", desc: "Complete workflow with approval system and tracking" },
    { icon: Settings, title: "Asset Tracking", desc: "Track all company assets with complete history" },
    { icon: Trophy, title: "Recognition System", desc: "Employee awards, achievements & appreciation program" },
    { icon: UserCheck, title: "Document Vault", desc: "Secure document storage and verification system" },
    { icon: BarChart3, title: "Advanced Analytics", desc: "Comprehensive insights, reporting dashboards and metrics" }
  ];

  const learningCategories = [
    { id: 'forYou', label: 'For You' },
    { id: 'hrSkills', label: 'HR Skills' },
    { id: 'leadership', label: 'Leadership' },
    { id: 'compliance', label: 'Compliance' },
    { id: 'technology', label: 'Technology' },
    { id: 'softSkills', label: 'Soft Skills' }
  ];

  const showcaseContent = {
    forYou: {
      title: "Stable Diffusion 3 Medium.",
      description: "Is our most advanced text-to-image AI model with two billion parameters, excelling in photorealism, handling complex prompts, generating clear text, and offering unparalleled creative possibilities.",
      btnPrimary: "Schedule a Demo",
      btnSecondary: "Start Free Trial",
      images: [
        "https://images.unsplash.com/photo-1480796927426-f609979314bd?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=300&h=200&fit=crop",
        "https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=300&h=200&fit=crop"
      ]
    },
    hrSkills: {
      title: "Smart Recruitment Hub.",
      description: "Streamline your hiring process with AI-powered candidate screening, automated job posting across platforms, and intelligent interview scheduling that saves hours of manual work.",
      btnPrimary: "Schedule a Demo",
      btnSecondary: "Start Free Trial",
      images: [
        "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1552664730-d307ca884978?w=300&h=200&fit=crop",
        "https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?w=300&h=200&fit=crop"
      ]
    },
    leadership: {
      title: "Team Performance Analytics.",
      description: "Monitor team productivity with real-time dashboards, track goals and milestones, and make data-driven decisions with comprehensive performance metrics and AI insights.",
      btnPrimary: "Schedule a Demo",
      btnSecondary: "Start Free Trial",
      images: [
        "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=300&h=200&fit=crop",
        "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=300&h=200&fit=crop"
      ]
    },
    compliance: {
      title: "Compliance Management.",
      description: "Stay compliant with automated policy tracking, secure document management, real-time regulatory updates, and comprehensive audit trails for your organization.",
      btnPrimary: "Schedule a Demo",
      btnSecondary: "Start Free Trial",
      images: [
        "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=300&h=200&fit=crop",
        "https://images.unsplash.com/photo-1573497019236-17f8177b81e8?w=300&h=200&fit=crop"
      ]
    },
    technology: {
      title: "HR Analytics Platform.",
      description: "Powerful analytics with customizable reports, trend analysis, predictive insights, and seamless integrations to drive strategic HR decisions across your organization.",
      btnPrimary: "Schedule a Demo",
      btnSecondary: "Start Free Trial",
      images: [
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=300&h=200&fit=crop",
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=300&h=200&fit=crop"
      ]
    },
    softSkills: {
      title: "Employee Engagement.",
      description: "Build a thriving workplace culture with pulse surveys, recognition programs, wellness initiatives, and feedback tools that boost employee satisfaction and retention.",
      btnPrimary: "Schedule a Demo",
      btnSecondary: "Start Free Trial",
      images: [
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=300&h=200&fit=crop",
        "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=300&h=200&fit=crop"
      ]
    }
  };

  const testimonials = [
    {
      name: "Rajesh Kumar",
      role: "HR Director",
      quote: "Pragva-HRMS transformed our HR operations. We've reduced administrative work by 60%."
    },
    {
      name: "Priya Sharma",
      role: "CEO",
      quote: "The best investment we made for our growing team. Analytics dashboard is amazing."
    },
    {
      name: "Amit Patel",
      role: "Operations Manager",
      quote: "Seamless integration and excellent support. Highly recommend for any organization."
    },
    {
      name: "Sneha Reddy",
      role: "HR Manager",
      quote: "Employee self-service portal has reduced our workload significantly. Great product!"
    },
    {
      name: "Vikram Singh",
      role: "Tech Lead",
      quote: "The leave management system saved us countless hours every month. Truly efficient."
    },
    {
      name: "Anita Desai",
      role: "Business Owner",
      quote: "Simple, intuitive and powerful. Perfect for managing our growing workforce."
    }
  ];

  const plans = [
    {
      name: "Starter",
      subtitle: "Perfect for testing",
      price: "Free",
      period: "/45 days",
      icon: Zap,
      features: [
        "Up to 10 employees",
        "Basic attendance tracking",
        "Leave management",
        "Notice board",
        "Email support"
      ],
      buttonText: "Start Free Trial",
      highlighted: false,
      badge: null
    },
    {
      name: "Growth",
      subtitle: "For small teams",
      price: "₹2,999",
      period: "/month",
      icon: TrendingUp,
      features: [
        "Up to 50 employees",
        "Everything in Starter",
        "Time clock & overtime",
        "Holiday calendar",
        "Work status tracking",
        "Priority support"
      ],
      buttonText: "Get Started",
      highlighted: false,
      badge: null
    },
    {
      name: "Professional",
      subtitle: "Most popular choice",
      price: "₹5,999",
      period: "/month",
      icon: Award,
      features: [
        "Up to 200 employees",
        "Everything in Growth",
        "Asset tracking",
        "Document management",
        "Analytics dashboard",
        "API access"
      ],
      buttonText: "Get Started",
      highlighted: true,
      badge: "Most Popular"
    },
    {
      name: "Enterprise",
      subtitle: "For large orgs",
      price: "Contact Us",
      period: "",
      icon: Building,
      features: [
        "Unlimited employees",
        "Everything in Professional",
        "Performance management",
        "Custom integrations",
        "Dedicated manager",
        "24/7 phone support",
        "SLA guarantee"
      ],
      buttonText: "Contact Sales",
      highlighted: false,
      badge: "Best Value"
    }
  ];

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  const handleDemoFormChange = (e) => {
    const { name, value } = e.target;

    if (name === 'phoneCode') {
      const format = getPhoneFormat(value);
      setDemoForm(prev => ({
        ...prev,
        phoneCode: value,
        phoneNumber: applyPhoneFormat(prev.phoneNumber, format)
      }));
    } else if (name === 'phoneNumber') {
      const format = getPhoneFormat(demoForm.phoneCode);
      const cleanValue = value.replace(/\D/g, '');
      const cleanPrev = demoForm.phoneNumber.replace(/\D/g, '');
      
      let newValue = value;
      if (cleanValue === cleanPrev && value.length < demoForm.phoneNumber.length) {
        newValue = cleanValue.slice(0, -1);
      }
      
      setDemoForm(prev => ({
        ...prev,
        phoneNumber: applyPhoneFormat(newValue, format)
      }));
    } else {
      setDemoForm(prev => ({ ...prev, [name]: value }));
    }

    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateDemoForm = () => {
    const errors = {};
    if (!demoForm.fullName.trim()) {
      errors.fullName = 'Please complete this required field.';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!demoForm.workEmail.trim()) {
      errors.workEmail = 'Please complete this required field.';
    } else if (!emailRegex.test(demoForm.workEmail.trim())) {
      errors.workEmail = 'Please enter a valid email address.';
    }
    
    const format = getPhoneFormat(demoForm.phoneCode);
    if (!demoForm.phoneNumber.trim()) {
      errors.phoneNumber = 'Please complete this required field.';
    } else if (format && demoForm.phoneNumber.length !== format.length) {
      errors.phoneNumber = `Please enter a complete phone number (${format}).`;
    }
    
    if (!demoForm.companyName.trim()) {
      errors.companyName = 'Please complete this required field.';
    }
    if (!demoForm.employeeCount) {
      errors.employeeCount = 'Please complete this required field.';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDemoSubmit = async (e) => {
    e.preventDefault();
    if (!validateDemoForm()) return;

    const payload = {
      fullName: demoForm.fullName,
      workEmail: demoForm.workEmail,
      phoneCode: demoForm.phoneCode,
      phoneNumber: demoForm.phoneNumber,
      companyName: demoForm.companyName,
      employeeCount: demoForm.employeeCount,
      source: 'landing_demo'
    };

    try {
      await marketingAPI.sendDemoRequest(payload);
      // Notify user and close modal
      toast.success('Demo request sent. Superadmin will be notified.');
      setShowDemoModal(false);
      setDemoForm({
        fullName: '',
        workEmail: '',
        phoneCode: '+91',
        phoneNumber: '',
        companyName: '',
        employeeCount: ''
      });
    } catch (err) {
      console.error('Failed to send demo request', err);
      toast.error('Failed to submit demo request. Please try again later.');
    }
  };

  return (
    <div className="landing-page">
      {/* Header */}
      <header className={`landing-header ${scrolled ? 'landing-header-scrolled' : ''}`}>
        <div className="landing-header-container">
          <div className="landing-header-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src={logoImage} alt="Pragva-HRMS" className="landing-logo-img" />
            <span className="landing-logo-text">Pragva-HRMS</span>
          </div>

          <nav className="landing-nav">
            <button className="landing-nav-link" onClick={() => scrollToSection('features-section')}>Features</button>
            <button className="landing-nav-link" onClick={() => scrollToSection('benefits-section')}>Benefits</button>
            <button className="landing-nav-link" onClick={() => scrollToSection('testimonials-section')}>Reviews</button>
          </nav>

          <div className="landing-header-actions">
            <button className="landing-btn-header-secondary" onClick={() => navigate('/login')}>
              Login
            </button>
            <button className="landing-btn-header-primary" onClick={() => navigate('/signup')}>
              Sign Up
            </button>
          </div>

          <button className="landing-mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <MenuIcon size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`landing-mobile-menu ${mobileMenuOpen ? 'active' : ''}`}>
          <button className="landing-mobile-nav-link" onClick={() => scrollToSection('features-section')}>Features</button>
          <button className="landing-mobile-nav-link" onClick={() => scrollToSection('benefits-section')}>Benefits</button>
          <button className="landing-mobile-nav-link" onClick={() => scrollToSection('testimonials-section')}>Reviews</button>
          <div className="landing-mobile-menu-actions">
            <button className="landing-btn-secondary-full" onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}>
              Login
            </button>
            <button className="landing-btn-primary-full" onClick={() => { navigate('/signup'); setMobileMenuOpen(false); }}>
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        {/* Decorative curved lines */}
        <div className="hero-curve hero-curve-left">
          <svg viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M200 0C100 100 100 300 200 400" stroke="currentColor" strokeWidth="3" fill="none" />
          </svg>
        </div>
        <div className="hero-curve hero-curve-right">
          <svg viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0C100 100 100 300 0 400" stroke="currentColor" strokeWidth="3" fill="none" />
          </svg>
        </div>

        <div className="landing-hero-container">
          {/* Social Proof Badge */}
          <div className="hero-social-proof">
            <div className="hero-avatars">
              <div className="hero-avatar">R</div>
              <div className="hero-avatar">P</div>
              <div className="hero-avatar">A</div>
            </div>
            <span className="hero-social-text">Loved by 20+ companies with a 4.9 rating</span>
          </div>

          {/* Main Headline */}
          <h1 className="landing-hero-title">
            From <span className="hero-highlight">time tracking</span> to analytics,
            <br />manage HR smarter!
          </h1>

          {/* Subtitle */}
          <p className="landing-hero-subtitle">
            Complete HR management solution for modern workplaces. Streamline operations with time tracking, leave management, and comprehensive analytics in one unified platform.
          </p>

          {/* CTA Buttons */}
          <div className="landing-hero-cta">
            <button className="landing-btn-hero-primary" onClick={() => navigate('/signup')}>
              Start Free Trial
            </button>
            <button className="landing-btn-hero-secondary" onClick={() => setShowDemoModal(true)}>
              Schedule a Demo
            </button>
          </div>

          {/* Hero Image Section */}
          <div className="hero-image-section">
            <div className="hero-main-image">
              <img
                src={heroImages[activeHeroImage].src}
                alt={heroImages[activeHeroImage].alt}
              />
            </div>

            {/* Hero Carousel Navigation Dots */}
            <div className="hero-carousel-nav">
              {heroImages.map((_, index) => (
                <button
                  key={index}
                  className={`hero-carousel-dot ${activeHeroImage === index ? 'active' : ''}`}
                  onClick={() => setActiveHeroImage(index)}
                  aria-label={`Slide ${index + 1}`}
                />
              ))}
            </div>

            {/* Left Floating Card */}
            <div className="hero-floating-card hero-floating-left">
              <div className="floating-card-icon">
                <Clock size={24} />
              </div>
              <h4>Time Management</h4>
              <p>Automated clock-in/out with shift management and overtime tracking.</p>
            </div>

            {/* Right Floating Card */}
            <div className="hero-floating-card hero-floating-right">
              <div className="floating-card-header">
                <span className="floating-card-label">Dashboard</span>
              </div>
              <h4>Analytics Overview</h4>
              <p className="floating-card-stats">12 Departments · 156 Active Employees</p>
              <div className="floating-card-metrics">
                <div className="metric-item">
                  <Users size={16} />
                </div>
                <div className="metric-item">
                  <BarChart3 size={16} />
                </div>
                <div className="metric-item">
                  <TrendingUp size={16} />
                </div>
                <div className="metric-more">+5</div>
              </div>
            </div>

            {/* Bottom Floating Card */}
            <div className="hero-floating-card hero-floating-bottom">
              <div className="floating-card-icon">
                <MessageSquare size={24} />
              </div>
              <h4>AI Voice Assistant</h4>
              <p>Smart voice-powered status updates and seamless team collaboration.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Recommended Learning Paths Section */}
      <section id="features-section" className="landing-learning-paths">
        <div className="landing-section-container">
          <div className="learning-paths-header">
            <h2 className="learning-paths-title">
              Recommended Learning Paths<br />
              Tailored to You
            </h2>
            <p className="learning-paths-subtitle">
              Curated courses based on your interests, activity, and trending topics.
            </p>
          </div>

          <div className="learning-paths-categories">
            {learningCategories.map((category) => (
              <button
                key={category.id}
                className={`learning-path-pill ${activeLearningCategory === category.id ? 'active' : ''}`}
                onClick={() => setActiveLearningCategory(category.id)}
              >
                {category.label}
              </button>
            ))}
            <button className="learning-path-pill more">
              More <span className="plus-icon">+</span>
            </button>
          </div>

          <div className="learning-paths-showcase" key={activeLearningCategory}>
            <div className="showcase-content">
              <h3 className="showcase-title">{showcaseContent[activeLearningCategory].title}</h3>
              <p className="showcase-description">
                {showcaseContent[activeLearningCategory].description}
              </p>
              <div className="showcase-buttons">
                <button className="showcase-btn-primary" onClick={() => setShowDemoModal(true)}>{showcaseContent[activeLearningCategory].btnPrimary}</button>
                <button className="showcase-btn-secondary" onClick={() => navigate('/signup')}>{showcaseContent[activeLearningCategory].btnSecondary}</button>
              </div>
            </div>
            <div className="showcase-images">
              <div className={`showcase-image-wrapper showcase-layout-${activeLearningCategory}`}>
                {/* Floating image 1 */}
                <div className="showcase-floating showcase-float-1">
                  <img src={showcaseContent[activeLearningCategory].images[1]} alt="Showcase" />
                </div>

                {/* Floating image 2 */}
                <div className="showcase-floating showcase-float-2">
                  <img src={showcaseContent[activeLearningCategory].images[2]} alt="Showcase" />
                </div>

                {/* Main center image */}
                <div className="showcase-main-image">
                  <img src={showcaseContent[activeLearningCategory].images[0]} alt="Main Showcase" />
                </div>

                {/* Floating image 3 */}
                <div className="showcase-floating showcase-float-3">
                  <img src={showcaseContent[activeLearningCategory].images[1]} alt="Showcase" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits-section" className="landing-benefits">
        <div className="landing-section-container">
          <div className="landing-section-header">
            <span className="landing-section-badge">Why Choose Us</span>
            <h2 className="landing-section-title">Built for Modern Workplaces</h2>
            <p className="landing-section-subtitle">
              Experience the difference with features designed for efficiency and growth
            </p>
          </div>

          <div className="landing-benefits-grid">
            {benefits.map((benefit, index) => (
              <div key={index} className="landing-benefit-card">
                <div className={`landing-benefit-icon ${benefit.gradient}`}>
                  <benefit.icon size={24} />
                </div>
                <h3 className="landing-benefit-title">{benefit.title}</h3>
                <p className="landing-benefit-desc">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features - Bento Grid */}
      <section className="landing-features-bento">
        <div className="landing-section-container">
          <div className="landing-section-header">
            <span className="landing-section-badge">Core Features</span>
            <h2 className="landing-section-title">Everything You Need</h2>
            <p className="landing-section-subtitle">
              Comprehensive tools to manage every aspect of HR operations
            </p>
          </div>

          <div className="landing-bento-grid">
            {keyFeatures.map((feature, index) => (
              <div key={index} className="landing-bento-card">
                <div className="landing-bento-icon">
                  <feature.icon size={24} />
                </div>
                <h3 className="landing-bento-title">{feature.title}</h3>
                <p className="landing-bento-desc">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials-section" className="landing-testimonials">
        <div className="landing-section-container">
          <div className="landing-testimonials-left">
            <h2 className="landing-testimonials-title">
              What <span>People Say</span> <span>About Us</span>
            </h2>

            <p className="landing-testimonials-subtitle">
              Discover how Pragva-HRMS has transformed HR operations for companies across industries.
            </p>

            {/* Navigation Arrows */}
            <div className="testimonial-nav">
              <button
                className="testimonial-nav-btn"
                onClick={() => setActiveTestimonial(prev => prev === 0 ? testimonials.length - 1 : prev - 1)}
                aria-label="Previous Testimonial"
              >
                <ChevronDown className="testimonial-nav-icon testimonial-nav-prev" />
              </button>
              <div className="testimonial-nav-dots">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    className={`testimonial-dot ${activeTestimonial === index ? 'active' : ''}`}
                    onClick={() => setActiveTestimonial(index)}
                    aria-label={`Testimonial ${index + 1}`}
                  />
                ))}
              </div>
              <button
                className="testimonial-nav-btn"
                onClick={() => setActiveTestimonial(prev => prev === testimonials.length - 1 ? 0 : prev + 1)}
                aria-label="Next Testimonial"
              >
                <ChevronDown className="testimonial-nav-icon testimonial-nav-next" />
              </button>
            </div>
          </div>

          <div className="landing-testimonials-right">
            <div className="landing-testimonial-card">
              <div className="testimonial-quote-icon">
                <Quote size={32} />
              </div>
              <p className="landing-testimonial-text">
                {testimonials[activeTestimonial].quote}
              </p>
              <div className="landing-testimonial-author">
                <div className="landing-testimonial-avatar">
                  {testimonials[activeTestimonial].name.charAt(0)}
                </div>
                <div className="landing-testimonial-info">
                  <span className="landing-testimonial-name">{testimonials[activeTestimonial].name}</span>
                  <span className="landing-testimonial-role">{testimonials[activeTestimonial].role}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Final CTA Section */}
      <section className="landing-cta">
        <div className="landing-cta-container">
          <div className="landing-cta-left">
            <span className="landing-cta-badge">Get Started Today</span>
            <h2 className="landing-cta-title">Ready to Transform Your HR?</h2>
            <p className="landing-cta-subtitle">
              Join hundreds of companies already using Pragva-HRMS to streamline their operations
            </p>
            <div className="landing-cta-buttons">
              <button className="landing-btn-cta-primary" onClick={() => navigate('/signup')}>
                Start Your Free Trial
                <ArrowRight size={18} />
              </button>
              <button className="landing-btn-cta-secondary" onClick={() => navigate('/admin/login')}>
                Schedule a Demo
              </button>
            </div>
            <div className="landing-cta-features">
              {['No credit card required', 'Free 15-day trial', 'Cancel anytime'].map((feature, index) => (
                <div key={index} className="landing-cta-feature">
                  <CheckCircle size={16} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="landing-cta-right">
            <div className="landing-cta-stats">
              <div className="landing-cta-stat">
                <span className="landing-cta-stat-number">20+</span>
                <span className="landing-cta-stat-label">Companies Trust Us</span>
              </div>
              <div className="landing-cta-stat">
                <span className="landing-cta-stat-number">500+</span>
                <span className="landing-cta-stat-label">Active Employees</span>
              </div>
              <div className="landing-cta-stat">
                <span className="landing-cta-stat-number">99.9%</span>
                <span className="landing-cta-stat-label">Uptime Guarantee</span>
              </div>
              <div className="landing-cta-stat">
                <span className="landing-cta-stat-number">4.9</span>
                <span className="landing-cta-stat-label">Customer Rating</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="landing-footer-main">
            <div className="landing-footer-brand">
              <div className="landing-footer-logo">
                <img src={logoImage} alt="Pragva-HRMS" className="landing-footer-logo-img" />
                <span className="landing-footer-logo-text">Pragva-HRMS</span>
              </div>
              <p className="landing-footer-desc">
                Empowering organizations with comprehensive HR management solutions.<br />
                Transform your HR operations with our next-generation platform.<br />
                <br />
                Manjeera Trinity Corporate, K P H B Phase 3, Kukatpally, Hyderabad, Telangana 500072 India<br />
                +91 8686260302<br />
                info@pragva.in
              </p>
            </div>

            <div className="landing-footer-links">
              <div className="landing-footer-links-col">
                <h4 className="landing-footer-links-title">Product</h4>
                <ul className="landing-footer-links-list">
                  <li><button onClick={() => scrollToSection('features-section')}>Features</button></li>
                  <li><button onClick={() => scrollToSection('testimonials-section')}>Reviews</button></li>
                  <li><button onClick={() => scrollToSection('features-section')}>Documentation</button></li>
                </ul>
              </div>
              <div className="landing-footer-links-col">
                <h4 className="landing-footer-links-title">Company</h4>
                <ul className="landing-footer-links-list">
                  <li><button onClick={() => scrollToSection('features-section')}>About Us</button></li>
                  <li><button onClick={() => setShowDemoModal(true)}>Careers</button></li>
                  <li><button onClick={() => scrollToSection('features-section')}>Blog</button></li>
                  <li><a href="mailto:info@pragva.in">Contact</a></li>
                </ul>
              </div>
              <div className="landing-footer-links-col">
                <h4 className="landing-footer-links-title">Legal</h4>
                <ul className="landing-footer-links-list">
                  <li><button type="button" onClick={() => navigate('/privacy-policy')} style={{ background: 'none', border: 'none', padding: 0, margin: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Privacy Policy</button></li>
                  <li><button type="button" onClick={() => navigate('/terms-of-service')} style={{ background: 'none', border: 'none', padding: 0, margin: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Terms of Service</button></li>
                  <li><button type="button" onClick={() => navigate('/data-protection')} style={{ background: 'none', border: 'none', padding: 0, margin: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Data Protection</button></li>
                  <li><button type="button" onClick={() => navigate('/data-retention')} style={{ background: 'none', border: 'none', padding: 0, margin: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>Data Retention</button></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <p className="landing-footer-copyright">
              © 2026 Pragadas Technologies Pvt. Ltd. All rights reserved.
            </p>
            <div className="landing-footer-social">
              <span>Made with care in India</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Demo Modal */}
      {showDemoModal && (
        <div className="demo-overlay" onClick={() => setShowDemoModal(false)}>
          <div className="demo-container" onClick={(e) => e.stopPropagation()}>
            {/* Left Panel - Visual */}
            <div className="demo-visual">
              <div className="demo-visual-bg">
                <div className="demo-orb demo-orb-1"></div>
                <div className="demo-orb demo-orb-2"></div>
                <div className="demo-orb demo-orb-3"></div>
              </div>
              <div className="demo-visual-content">
                <div className="demo-visual-icon">
                  <Sparkles size={32} />
                </div>
                <h3 className="demo-visual-title">Let's Build Something Amazing</h3>
                <p className="demo-visual-text">Join 20+ companies transforming their HR operations</p>
                <div className="demo-visual-stats">
                  <div className="demo-stat">
                    <span className="demo-stat-number">30</span>
                    <span className="demo-stat-label">min call</span>
                  </div>
                  <div className="demo-stat-divider"></div>
                  <div className="demo-stat">
                    <span className="demo-stat-number">100%</span>
                    <span className="demo-stat-label">free</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Form */}
            <div className="demo-form-panel">
              <button className="demo-close" onClick={() => setShowDemoModal(false)}>
                <X size={20} />
              </button>

              <div className="demo-form-header">
                <span className="demo-form-badge">Free Demo</span>
                <h2 className="demo-form-title">Schedule your personalized demo</h2>
              </div>

              <form className="demo-form" onSubmit={handleDemoSubmit}>
                <div className="demo-field">
                  <input
                    type="text"
                    name="fullName"
                    className={`demo-input ${formErrors.fullName ? 'error' : ''} ${demoForm.fullName ? 'has-value' : ''}`}
                    value={demoForm.fullName}
                    onChange={handleDemoFormChange}
                    placeholder=" "
                  />
                  <label className="demo-label">Your name <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className="demo-input-line"></div>
                  {formErrors.fullName && <span className="demo-error">{formErrors.fullName}</span>}
                </div>

                <div className="demo-field">
                  <input
                    type="email"
                    name="workEmail"
                    className={`demo-input ${formErrors.workEmail ? 'error' : ''} ${demoForm.workEmail ? 'has-value' : ''}`}
                    value={demoForm.workEmail}
                    onChange={handleDemoFormChange}
                    placeholder=" "
                  />
                  <label className="demo-label">Work email <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className="demo-input-line"></div>
                  {formErrors.workEmail && <span className="demo-error">{formErrors.workEmail}</span>}
                </div>

                <div className="demo-field-row">
                  <div className="demo-field demo-field-small">
                    <select
                      name="phoneCode"
                      className="demo-select-mini"
                      value={demoForm.phoneCode}
                      onChange={handleDemoFormChange}
                    >
                      {phoneCountryOptions.map(option => (
                        <option key={option.code} value={option.code}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="demo-field demo-field-grow">
                    <input
                      type="tel"
                      name="phoneNumber"
                      className={`demo-input ${formErrors.phoneNumber ? 'error' : ''} ${demoForm.phoneNumber ? 'has-value' : ''}`}
                      value={demoForm.phoneNumber}
                      onChange={handleDemoFormChange}
                      placeholder=" "
                    />
                    <label className="demo-label">Phone number <span style={{ color: '#ef4444' }}>*</span></label>
                    <div className="demo-input-line"></div>
                    {formErrors.phoneNumber && <span className="demo-error">{formErrors.phoneNumber}</span>}
                  </div>
                </div>

                <div className="demo-field">
                  <input
                    type="text"
                    name="companyName"
                    className={`demo-input ${formErrors.companyName ? 'error' : ''} ${demoForm.companyName ? 'has-value' : ''}`}
                    value={demoForm.companyName}
                    onChange={handleDemoFormChange}
                    placeholder=" "
                  />
                  <label className="demo-label">Company <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className="demo-input-line"></div>
                  {formErrors.companyName && <span className="demo-error">{formErrors.companyName}</span>}
                </div>

                <div className="demo-field">
                  <select
                    name="employeeCount"
                    className={`demo-select ${formErrors.employeeCount ? 'error' : ''} ${demoForm.employeeCount ? 'has-value' : ''}`}
                    value={demoForm.employeeCount}
                    onChange={handleDemoFormChange}
                  >
                    <option value="" disabled hidden></option>
                    <option value="1-10">1-10 people</option>
                    <option value="11-50">11-50 people</option>
                    <option value="51-200">51-200 people</option>
                    <option value="201-500">201-500 people</option>
                    <option value="500+">500+ people</option>
                  </select>
                  <label className="demo-label">Team size <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className="demo-input-line"></div>
                  {formErrors.employeeCount && <span className="demo-error">{formErrors.employeeCount}</span>}
                </div>

                <button type="submit" className="demo-submit">
                  <span>Book My Demo</span>
                  <ArrowRight size={18} />
                </button>
              </form>

              <p className="demo-privacy">By submitting, you agree to our privacy policy</p>
            </div>
          </div>
        </div>
      )}

      {/* Free Trial Modal */}
      {showTrialModal && (
        <div className="demo-overlay" onClick={() => setShowTrialModal(false)}>
          <div className="trial-container" onClick={(e) => e.stopPropagation()}>
            {/* Left Panel - Visual */}
            <div className="trial-visual">
              <div className="demo-visual-bg">
                <div className="demo-orb demo-orb-1"></div>
                <div className="demo-orb demo-orb-2"></div>
                <div className="demo-orb demo-orb-3"></div>
              </div>
              <div className="demo-visual-content">
                <div className="demo-visual-icon">
                  <Rocket size={32} />
                </div>
                <h3 className="demo-visual-title">Start Your Free Journey</h3>
                <p className="demo-visual-text">Experience the full power of Pragva-HRMS</p>
                <div className="demo-visual-stats">
                  <div className="demo-stat">
                    <span className="demo-stat-number">45</span>
                    <span className="demo-stat-label">days free</span>
                  </div>
                  <div className="demo-stat-divider"></div>
                  <div className="demo-stat">
                    <span className="demo-stat-number">No</span>
                    <span className="demo-stat-label">Credit Card Required</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Info */}
            <div className="trial-info-panel">
              <button className="demo-close" onClick={() => setShowTrialModal(false)}>
                <X size={20} />
              </button>

              <div className="trial-info-header">
                <span className="demo-form-badge">Free Trial</span>
                <h2 className="demo-form-title">Everything you need to get started</h2>
              </div>

              <div className="trial-features-list">
                <div className="trial-feature-item">
                  <div className="trial-feature-icon">
                    <CheckCircle size={20} />
                  </div>
                  <div className="trial-feature-content">
                    <h4>Full Feature Access</h4>
                    <p>Explore all premium features during your trial period</p>
                  </div>
                </div>

                <div className="trial-feature-item">
                  <div className="trial-feature-icon">
                    <CheckCircle size={20} />
                  </div>
                  <div className="trial-feature-content">
                    <h4>Up to 10 Employees</h4>
                    <p>Add your team members and start managing right away</p>
                  </div>
                </div>

                <div className="trial-feature-item">
                  <div className="trial-feature-icon">
                    <CheckCircle size={20} />
                  </div>
                  <div className="trial-feature-content">
                    <h4>Email Support</h4>
                    <p>Get help whenever you need it from our support team</p>
                  </div>
                </div>

                <div className="trial-feature-item">
                  <div className="trial-feature-icon">
                    <CheckCircle size={20} />
                  </div>
                  <div className="trial-feature-content">
                    <h4>No Credit Card Required</h4>
                    <p>Start your trial instantly without any payment info</p>
                  </div>
                </div>
              </div>

              <div className="trial-actions">
                <button className="demo-submit" onClick={() => { setShowTrialModal(false); navigate('/signup'); }}>
                  <span>Start Free Trial</span>
                  <ArrowRight size={18} />
                </button>
                <p className="trial-note">No commitment. Cancel anytime.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandingPage;
