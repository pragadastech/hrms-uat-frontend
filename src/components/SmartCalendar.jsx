import React, { useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './SmartCalendar.css';

const startOfYear = (date = new Date()) => new Date(date.getFullYear(), 0, 1);

/**
 * SmartCalendar Component
 *
 * @param {Object} props
 * @param {Array} props.events - Array of event objects { date: 'YYYY-MM-DD', title: string, type: 'holiday'|'present'|'absent'|'leave' }
 * @param {Function} props.onDateClick - Handler for date click
 * @param {String} props.className - Optional container class
 * @param {Function} props.onMonthChange - Handler for when the active start date (month/year) changes
 * @param {Date|string|number} props.defaultDate - Initial calendar date (defaults to Jan 1 of the current year)
 */
export default function SmartCalendar({
  events = [],
  onDateClick,
  className,
  onMonthChange,
  defaultDate,
}) {
  const initialDate = useMemo(() => {
    if (defaultDate instanceof Date && !Number.isNaN(defaultDate.getTime())) {
      return new Date(defaultDate.getFullYear(), defaultDate.getMonth(), defaultDate.getDate());
    }
    if (defaultDate != null && defaultDate !== '') {
      const parsed = new Date(defaultDate);
      if (!Number.isNaN(parsed.getTime())) {
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      }
    }
    return startOfYear();
  }, [defaultDate]);

  const [value, setValue] = useState(initialDate);
  const [activeStartDate, setActiveStartDate] = useState(initialDate);

  // Helper to find events for a specific date
  const getEventsForDate = (date) => {
    // Normalize date to YYYY-MM-DD
    const dateStr = date.toLocaleDateString('en-CA'); // 'en-CA' gives YYYY-MM-DD format
    return events.filter(e => {
      if (!e.date) return false;
      // Handle both ISO string and Date objects
      const eDate = new Date(e.date).toLocaleDateString('en-CA');
      return eDate === dateStr;
    });
  };

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const dayEvents = getEventsForDate(date);

      if (dayEvents.length > 0) {
        return (
          <div className="calendar-tile-content">
            {dayEvents.map((ev, idx) => (
              <div key={idx} className={`calendar-marker status-${ev.type}`}>
                {ev.title}
              </div>
            ))}
          </div>
        );
      }
    }
    return null;
  };

  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      // Check if weekend
      const day = date.getDay();
      if (day === 0 || day === 6) {
        return 'weekend-tile';
      }
    }
    return null;
  };

  const handleActiveStartDateChange = (args) => {
    if (args?.activeStartDate) {
      setActiveStartDate(args.activeStartDate);
    }
    if (typeof onMonthChange === 'function') {
      onMonthChange(args);
    }
  };

  return (
    <div className={`smart-calendar-container ${className || ''}`}>
      <Calendar
        onChange={setValue}
        value={value}
        activeStartDate={activeStartDate}
        onActiveStartDateChange={handleActiveStartDateChange}
        tileContent={tileContent}
        tileClassName={tileClassName}
        onClickDay={onDateClick}
        nextLabel={<ChevronRight size={20} />}
        prevLabel={<ChevronLeft size={20} />}
        next2Label={null}
        prev2Label={null}
        showNeighboringMonth={true}
        minDetail="year"
        defaultActiveStartDate={initialDate}
      />
    </div>
  );
}
