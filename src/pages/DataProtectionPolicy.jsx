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

const DataProtectionPolicy = () => (
  <div style={{background: "#f4f7fa", minHeight: "100vh", padding: "3rem 0"}}>
    <div style={{maxWidth: 900, margin: "0 auto"}}>
      <div style={sectionStyle}>
        <h1 style={headingStyle}>Data Protection & Security Policy</h1>
        <div style={{fontSize: "1.1rem", color: "#333"}}>
          <div style={subheadingStyle}>Security Framework</div>
          <p>Pragva HRMS follows enterprise-grade security practices designed to protect confidentiality, integrity, and availability of data.</p>

          <div style={subheadingStyle}>Technical Controls</div>
          <ul style={{marginLeft: 24}}>
            <li>Role-based access control</li>
            <li>Strong password hashing and encryption</li>
            <li>HTTPS for all communications</li>
            <li>Database encryption at rest</li>
            <li>Comprehensive audit logging</li>
            <li>Regular backups and disaster recovery testing</li>
          </ul>

          <div style={subheadingStyle}>Biometric Data Handling</div>
          <p>Biometric data is collected only with explicit consent and is used solely for authentication and attendance purposes.</p>

          <div style={subheadingStyle}>Data Retention Policy</div>
          <p>Employee personal data is retained for a period of one (1) year following employee exit for compliance and statutory audit purposes. Clients may request deletion earlier where legally permissible. Automated deletion processes ensure data is permanently removed after the retention period.</p>

          <div style={subheadingStyle}>Contact & Grievance Redressal</div>
          <p>For grievances or data protection concerns, please contact:</p>
          <p>Pragadas Technologies Private Limited<br/>
          Email: <a href="mailto:support@pragva.in">support@pragva.in</a></p>
        </div>
        <div style={{textAlign: "center", color: "#888", fontSize: "0.95rem", marginTop: "2.5rem"}}>
          &copy; 2026 Pragadas Technologies Pvt. Ltd. All rights reserved.
        </div>
      </div>
    </div>
  </div>
);

export default DataProtectionPolicy;
