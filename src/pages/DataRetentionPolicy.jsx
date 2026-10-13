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

const DataRetentionPolicy = () => (
  <div style={{background: "#f4f7fa", minHeight: "100vh", padding: "3rem 0"}}>
    <div style={{maxWidth: 900, margin: "0 auto"}}>
      <div style={sectionStyle}>
        <h1 style={headingStyle}>Data Retention Policy</h1>
        <div style={{fontSize: "1.1rem", color: "#333"}}>
          <div style={subheadingStyle}>Retention Period</div>
          <p>Employee personal data is retained for one (1) year after employee exit for statutory and audit purposes.</p>

          <div style={subheadingStyle}>Deletion</div>
          <p>Clients may request manual deletion where legally permissible. Automated deletion is enforced after the retention period.</p>

          <div style={subheadingStyle}>Security Practices</div>
          <ul style={{marginLeft: 24}}>
            <li>Role-based access control</li>
            <li>Password hashing and encryption</li>
            <li>HTTPS enforced communication</li>
            <li>Database encryption at rest</li>
            <li>Audit logs and monitoring</li>
            <li>Regular backups and disaster recovery</li>
          </ul>

          <div style={subheadingStyle}>Biometric Data</div>
          <p>Biometric data is collected only with explicit consent and used solely for authentication and attendance.</p>
        </div>
        <div style={{textAlign: "center", color: "#888", fontSize: "0.95rem", marginTop: "2.5rem"}}>
          &copy; 2026 Pragadas Technologies Pvt. Ltd. All rights reserved.
        </div>
      </div>
    </div>
  </div>
);

export default DataRetentionPolicy;
