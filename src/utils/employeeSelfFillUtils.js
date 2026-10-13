/** Fields the employee can fill via self-fill link (subset of Add Employee form). */
export const EMPLOYEE_SELF_FILL_FIELDS = [
  'firstName', 'lastName', 'phoneNumber', 'email', 'dateOfBirth', 'maritalStatus',
  'gender', 'otherGender', 'nationality', 'otherNationality', 'emergencyContact',
  'emergencyPhone', 'bloodGroup', 'address', 'city', 'state', 'zipCode', 'designation',
  'panNumber', 'uanNumber', 'aadhaarNumber', 'highestQualification', 'primarySkills',
  'secondarySkills', 'experienceYears',
];

export const initialEmployeeSelfFillState = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  email: '',
  dateOfBirth: '',
  maritalStatus: '',
  gender: '',
  otherGender: '',
  nationality: '',
  otherNationality: '',
  emergencyContact: '',
  emergencyPhone: '',
  bloodGroup: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  designation: '',
  panNumber: '',
  uanNumber: '',
  aadhaarNumber: '',
  highestQualification: '',
  primarySkills: '',
  secondarySkills: '',
  experienceYears: '',
  appointmentLetter: null,
  salarySlips: null,
  relivingLetter: null,
  experienceLetter: null,
};

/** Map API self-fill payload into Add Employee formData (HR-only fields unchanged). */
export function mapSelfFillToEmployeeForm(selfFillForm, currentForm = {}) {
  if (!selfFillForm || typeof selfFillForm !== 'object') {
    return currentForm;
  }
  const merged = { ...currentForm };
  EMPLOYEE_SELF_FILL_FIELDS.forEach((key) => {
    if (selfFillForm[key] != null && selfFillForm[key] !== '') {
      merged[key] = selfFillForm[key];
    }
  });
  return merged;
}

export function getSubmittedDocumentNames(selfFillForm) {
  if (!selfFillForm?.documents) return [];
  return Object.entries(selfFillForm.documents).map(([field, name]) => ({
    field,
    name,
  }));
}
