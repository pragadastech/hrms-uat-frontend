
import React from "react";

const sectionStyle = {
  background: "#fff",
  borderRadius: "1rem",
  boxShadow: "0 2px 16px 0 rgba(60,72,100,0.08)",
  marginBottom: "2rem",
  padding: "2rem 2.5rem"
};

const headingStyle = {
  color: "#1a237e",
  fontWeight: 700,
  marginBottom: "1rem"
};

const subheadingStyle = {
  color: "#3949ab",
  fontWeight: 600,
  marginTop: "2rem",
  marginBottom: "0.5rem"
};

const PrivacyPolicy = () => (
  <div style={{background: "#f4f7fa", minHeight: "100vh", padding: "3rem 0"}}>
    <div style={{maxWidth: 900, margin: "0 auto"}}>
      <div style={sectionStyle}>
        <h1 style={headingStyle}>Privacy Policy</h1>
        <div style={{fontSize: "1.1rem", color: "#333"}}>
          <div style={subheadingStyle}>1. Introduction</div>
          <p>Pragadas Technologies Private Limited ("Company", "we", "our", or "us") operates Pragva HRMS, a web and mobile-based Human Resource Management System intended for workforce administration and statutory audit support. This Privacy Policy explains in detail how personal data is collected, used, stored, disclosed, and protected in accordance with the Digital Personal Data Protection Act, 2023 (India) and other applicable laws.</p>

          <div style={subheadingStyle}>2. Scope of This Policy</div>
          <p>This policy applies to all users of Pragva HRMS, including client organizations, their administrators, HR users, managers, and employees whose personal data is processed on the platform.</p>

          <div style={subheadingStyle}>3. Categories of Personal Data Collected</div>
          <ul style={{marginLeft: 24}}>
            <li>Identity and contact information such as name, residential address, phone number, email address, date of birth, and gender</li>
            <li>Employment-related data including attendance, working hours, shift information, leave records, and holiday usage</li>
            <li>Medical leave information (limited to leave classification, not medical reports)</li>
            <li>Employee-submitted documents such as Aadhaar, PAN, and other identity proofs</li>
            <li>Profile photographs and emergency contact details</li>
            <li>Biometric data such as fingerprint or facial recognition data, collected strictly with explicit consent</li>
            <li><b>No Location Tracking or Storage:</b> We do not collect, store, or track your location data at any time. Geolocation coordinates are accessed strictly in real-time by your device only during the exact moment of clock-in and clock-out to verify your attendance, and this data is never saved.</li>
          </ul>

          <div style={subheadingStyle}>4. Purpose and Lawful Basis of Processing</div>
          <p>Personal data is processed only for legitimate business purposes including:</p>
          <ul style={{marginLeft: 24}}>
            <li>Human resource administration and workforce management</li>
            <li>Attendance, leave, and access control management</li>
            <li>Compliance with applicable labour and statutory audit requirements</li>
            <li>Platform security, access control, and fraud prevention</li>
            <li>Pragva HRMS does not provide payroll processing or salary computation services.</li>
          </ul>

          <div style={subheadingStyle}>5. Consent Management</div>
          <p>Consent for collection and processing of personal data is obtained by the client organization from employees at the time of onboarding. Biometric data is collected only after obtaining explicit and informed consent. Consent records are maintained within the system and can be withdrawn as permitted by law.</p>

          <div style={subheadingStyle}>6. Data Sharing and Third Parties</div>
          <p>Personal data is not sold or shared for commercial purposes. Data may be shared only with:</p>
          <ul style={{marginLeft: 24}}>
            <li>Cloud infrastructure providers such as Amazon Web Services (AWS)</li>
            <li>Authorized service providers for email, SMS, or notification delivery</li>
            <li>All third parties are bound by confidentiality and data protection obligations.</li>
          </ul>

          <div style={subheadingStyle}>7. Data Security Measures</div>
          <p>We implement appropriate technical and organizational measures including encryption, role-based access controls, audit logs, secure backups, disaster recovery mechanisms, and restricted administrative access to protect personal data.</p>

          <div style={subheadingStyle}>8. Data Retention</div>
          <p>Employee personal data is retained for one (1) year after employee exit for statutory and audit purposes unless otherwise instructed by the client. Data is automatically deleted after the retention period.</p>

          <div style={subheadingStyle}>9. Rights of Data Principals</div>
          <p>Data principals may request access, correction, or deletion of their personal data through their employer or authorized HR administrator.</p>

          <div style={subheadingStyle}>10. Contact Information</div>
          <p>For privacy-related questions or concerns: Email: <a href="mailto:support@pragva.in">support@pragva.in</a></p>
        </div>
        <div style={{textAlign: "center", color: "#888", fontSize: "0.95rem", marginTop: "2.5rem"}}>
          &copy; 2026 Pragadas Technologies Pvt. Ltd. All rights reserved.
        </div>
      </div>
    </div>
  </div>
);

export default PrivacyPolicy;
