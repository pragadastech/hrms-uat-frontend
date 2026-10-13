
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

const TermsOfService = () => (
  <div style={{background: "#f4f7fa", minHeight: "100vh", padding: "3rem 0"}}>
    <div style={{maxWidth: 900, margin: "0 auto"}}>
      <div style={sectionStyle}>
        <h1 style={headingStyle}>Terms of Service</h1>
        <div style={{fontSize: "1.1rem", color: "#333"}}>
          <div style={subheadingStyle}>1. Acceptance of Terms</div>
          <p>By accessing or using Pragva HRMS, the client organization and its authorized users agree to be bound by these Terms of Service.</p>

          <div style={subheadingStyle}>2. Description of Service</div>
          <p>Pragva HRMS provides digital tools for HR administration, attendance tracking, leave management, employee record maintenance, and statutory audit support. The platform does not provide payroll processing services.</p>

          <div style={subheadingStyle}>3. Client Responsibilities</div>
          <p>Clients are responsible for ensuring that data uploaded to the platform is accurate, lawful, and collected with appropriate employee consent.</p>

          <div style={subheadingStyle}>4. User Access and Security</div>
          <p>User access is governed by role-based permissions configured by the client organization. Users must maintain confidentiality of login credentials.</p>

          <div style={subheadingStyle}>5. Data Ownership</div>
          <p>All data uploaded to Pragva HRMS remains the exclusive property of the client organization.</p>

          <div style={subheadingStyle}>6. Limitation of Liability</div>
          <p>The Company shall not be liable for indirect, incidental, or consequential damages arising from use of the platform.</p>

          <div style={subheadingStyle}>7. Governing Law</div>
          <p>These Terms are governed by and construed in accordance with the laws of India.</p>
        </div>
        <div style={{textAlign: "center", color: "#888", fontSize: "0.95rem", marginTop: "2.5rem"}}>
          &copy; 2026 Pragadas Technologies Pvt. Ltd. All rights reserved.
        </div>
      </div>
    </div>
  </div>
);

export default TermsOfService;
