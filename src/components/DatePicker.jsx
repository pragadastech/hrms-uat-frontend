import React from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const parseLocalDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const clean = String(value).includes('T') ? String(value).split('T')[0] : String(value).trim();
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

export default function DatePicker({ id, value, onChange, minDate, maxDate, disabled, placeholderText = 'Select date' }) {
  return (
    <div className="hr-datepicker-wrap">
      <ReactDatePicker
        id={id}
        selected={parseLocalDate(value)}
        onChange={(date) => onChange(date)}
        minDate={minDate ? parseLocalDate(minDate) : undefined}
        maxDate={maxDate ? parseLocalDate(maxDate) : undefined}
        dateFormat="dd MMM yyyy"
        disabled={disabled}
        placeholderText={placeholderText}
        className="hr-datepicker-input"
        popperPlacement="bottom-start"
        showPopperArrow={false}
        autoComplete="off"
        portalId="root"
        shouldCloseOnSelect
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        peekNextMonth
        strictParsing
      />
    </div>
  );
}
