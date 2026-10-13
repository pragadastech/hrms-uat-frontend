import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Search, Plus, Calendar, X, Loader2, Download, Upload, FileText, ChevronDown, LayoutGrid, Calendar as CalendarIcon, List as ListIcon, Edit2, Trash2, Sparkles, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { holidayCalendarAPI } from '../services/api';
import Header from '../components/Header';
import SmartCalendar from '../components/SmartCalendar';
import { toast } from 'react-hot-toast';
import './Holidays.css';
import {
  DEFAULT_HOLIDAY_IMAGE,
  getHolidayImageUrl,
  getLocalHolidayImage,
  getRemoteHolidayImageUrl,
} from '../utils/holidayImages';

function HolidayImage({ name, monthIndex, className = 'hl-card-img' }) {
  const localSrc = getLocalHolidayImage(name);
  const remoteSrc = getRemoteHolidayImageUrl(name);
  const [src, setSrc] = useState(() => getHolidayImageUrl(name));
  const [failed, setFailed] = useState(false);
  const isThumb = className.includes('thumb');

  const handleError = () => {
    if (localSrc && src === localSrc && remoteSrc) {
      setSrc(remoteSrc);
      return;
    }
    if (src !== DEFAULT_HOLIDAY_IMAGE) {
      setSrc(DEFAULT_HOLIDAY_IMAGE);
      return;
    }
    setFailed(true);
  };

  if (failed) {
    return (
      <div
        className={`hl-card-fallback hl-fallback--${monthIndex % 12} ${isThumb ? 'hl-thumb-fallback' : ''}`}
        aria-hidden="true"
      >
        <Calendar size={isThumb ? 20 : 40} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      decoding="async"
      onError={handleError}
    />
  );
}

export default function Holidays() {
  const { hasAdminAccess } = useAuth();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('upcoming'); // 'upcoming' | 'past'
  const [visualMode, setVisualMode] = useState('grid'); // 'grid' | 'calendar' | 'list'
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    date: '',
    day: '',
    type: 'Public Holiday',
    region: 'All',
    isOptional: false,
    selectionDeadline: ''
  });
  const [optionalHolidaysInfo, setOptionalHolidaysInfo] = useState({
    maxQuota: 2,
    selectedCount: 0,
    quotaConsumed: 0,
    holidays: []
  });
  const [loadingOptional, setLoadingOptional] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const fileInputRef = useRef(null);
  const actionsRef = useRef(null);

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target)) {
        setShowImportExport(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch holidays
  const fetchHolidays = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = hasAdminAccess()
        ? await holidayCalendarAPI.getAllHolidays()
        : await holidayCalendarAPI.getActiveHolidays();

      console.log('Holidays API Response:', response);

      // Handle different response structures
      let holidaysData = [];
      if (Array.isArray(response)) {
        holidaysData = response;
      } else if (response?.data) {
        if (Array.isArray(response.data)) {
          holidaysData = response.data;
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          holidaysData = response.data.data;
        }
      } else if (response?.holidays && Array.isArray(response.holidays)) {
        holidaysData = response.holidays;
      }

      console.log('Parsed holidays:', holidaysData);
      setHolidays(holidaysData);
    } catch (err) {
      console.error('Error fetching holidays:', err);
      setError('Failed to load holidays');
      toast.error('Failed to load holidays');
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptionalHolidays = async () => {
    try {
      setLoadingOptional(true);
      const response = await holidayCalendarAPI.getOptionalHolidays();
      if (response?.data) {
        setOptionalHolidaysInfo(response.data);
      }
    } catch (err) {
      console.error('Error fetching optional holidays:', err);
    } finally {
      setLoadingOptional(false);
    }
  };

  const handleOptionalHolidayToggle = async (holidayId, isSelected) => {
    try {
      setLoadingOptional(true);
      if (isSelected) {
        await holidayCalendarAPI.deselectOptionalHoliday(holidayId);
        toast.success('Optional holiday deselected');
      } else {
        await holidayCalendarAPI.selectOptionalHoliday(holidayId);
        toast.success('Optional holiday selected');
      }
      await fetchOptionalHolidays();
    } catch (err) {
      console.error('Error toggling optional holiday:', err);
      const msg = err.response?.data?.error || err.response?.data?.message || 'Action failed';
      toast.error(msg);
    } finally {
      setLoadingOptional(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
    if (!hasAdminAccess()) {
      fetchOptionalHolidays();
    }
  }, [hasAdminAccess]);

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHoliday.name || !newHoliday.date) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const dateObj = new Date(newHoliday.date);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

      const payload = {
        name: newHoliday.name,
        date: newHoliday.date,
        type: newHoliday.type || 'Public Holiday',
        region: newHoliday.region || 'All',
        day: dayName,
        isOptional: newHoliday.isOptional || false,
        selectionDeadline: newHoliday.selectionDeadline || null
      };

      console.log(`${isEditing ? 'Updating' : 'Creating'} holiday with payload:`, payload);
      const response = isEditing
        ? await holidayCalendarAPI.updateHoliday(editId, payload)
        : await holidayCalendarAPI.createHoliday(payload);
      console.log('Holiday saved:', response);

      toast.success(`Holiday ${isEditing ? 'updated' : 'added'} successfully!`);

      // Reset form and close modal
      setNewHoliday({ name: '', date: '', day: '', type: 'Public Holiday', region: 'All', isOptional: false, selectionDeadline: '' });
      setShowAddModal(false);
      setIsEditing(false);
      setEditId(null);

      // Refresh holidays list
      await fetchHolidays();
      await fetchOptionalHolidays();
    } catch (err) {
      console.error('Error adding holiday:', err);
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || 'Failed to add holiday';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (holiday) => {
    setEditId(holiday.id || holiday._id);
    setNewHoliday({
      name: holiday.name,
      date: holiday.date,
      type: holiday.type || 'Public Holiday',
      region: holiday.region || 'All',
      day: holiday.day,
      isOptional: holiday.isOptional || false,
      selectionDeadline: holiday.selectionDeadline || ''
    });
    setIsEditing(true);
    setShowAddModal(true);
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) {
      return;
    }

    try {
      setLoading(true);
      await holidayCalendarAPI.deleteHoliday(id);
      toast.success('Holiday deleted successfully');
      await fetchHolidays();
      await fetchOptionalHolidays();
    } catch (err) {
      console.error('Error deleting holiday:', err);
      toast.error('Failed to delete holiday');
    } finally {
      setLoading(false);
    }
  };

  const handleExportOptionalReport = async () => {
    try {
      const response = await holidayCalendarAPI.getOptionalHolidaysReport();
      const reportData = response.data || [];
      if (reportData.length === 0) {
        toast.error("No selection data available");
        return;
      }
      const headers = ["Holiday Name", "Selection Count"];
      const rows = reportData.map(r => [r.holiday, r.selectedCount]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${(cell || '0').toString().replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `optional_holidays_selections_report.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Selections report exported!");
    } catch (err) {
      console.error("Failed to export selections report:", err);
      toast.error("Failed to export selections report");
    }
  };

  const handleExportCSV = () => {
    if (holidays.length === 0) {
      toast.error("No holidays to export");
      return;
    }

    const headers = ["Date", "Day", "Holiday", "Type", "Region"];
    const rows = holidays.map(h => [
      h.date,
      h.day || getDayName(h.date),
      h.name,
      h.type || 'Public Holiday',
      h.region || 'All'
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `holidays_${new Date().getFullYear()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadTemplate = () => {
    const headers = ["Date", "Day", "Holiday"];
    const rows = [
      ["2026-01-01", "Thursday", "New Year's Day"],
      ["2026-01-15", "Thursday", "Sankranti / Pongal"],
      ["2026-01-26", "Monday", "Republic Day"]
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "holiday_import_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const processRows = async (rows) => {
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;

    // Create a Set of existing holiday dates for O(1) lookup
    const existingDates = new Set(holidays.map(h => h.date));

    toast.loading("Importing holidays...", { id: 'importLoader' });

    for (const cols of rows) {
      // Skip truly empty rows
      if (!cols || cols.length === 0 || cols.every(c => !c)) {
        skippedCount++;
        continue;
      }

      if (cols.length < 3 && !cols[0]) {
        skippedCount++;
        continue;
      }

      let dateStr = cols[0];
      let holidayName = cols[2];
      let type = cols[3] || 'Public Holiday';
      let region = cols[4] || 'All';

      const normalizeDate = (str) => {
        if (!str) return null;
        const s = String(str).trim();
        if (!s) return null;

        // Try YYYY-MM-DD or variants
        const isoMatch = s.match(/^(\d{2,4})[/-](\d{1,2})[/-](\d{1,2})$/);
        if (isoMatch) {
          let [_, y, m, d] = isoMatch;
          if (y.length === 2) y = "20" + y;
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        // Handle Excel Date Numbers
        if (!isNaN(s) && Number(s) > 30000) {
          try {
            const date = XLSX.SSF.parse_date_code(Number(s));
            return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
          } catch (e) { }
        }

        // General date parsing (handles "1-Jan", "Jan 1, 2026" etc.)
        try {
          const d = new Date(s);
          if (!isNaN(d.getTime())) {
            // If year is 2001 (default for many incomplete strings), use current or next year
            let year = d.getFullYear();
            if (year < 2000) year = new Date().getFullYear();

            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        } catch (e) { }

        return null;
      };

      const finalDate = normalizeDate(dateStr);

      if (!finalDate || !holidayName) {
        console.warn("Skipping invalid row:", cols, "Final date:", finalDate);
        failCount++;
        continue;
      }

      // Check for duplicate in current import OR in existing list
      if (existingDates.has(finalDate)) {
        duplicateCount++;
        continue;
      }

      // Add to set to catch duplicates within the same file too
      existingDates.add(finalDate);

      try {
        await holidayCalendarAPI.createHoliday({
          name: holidayName,
          date: finalDate,
          type: type,
          region: region
        });
        successCount++;
        // Update toast every 5 items
        if (successCount % 5 === 0) {
          toast.loading(`Importing... (${successCount} done)`, { id: 'importLoader' });
        }
      } catch (err) {
        console.error("Import failed for row", cols, err);
        const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message;

        // If the server also reports it as a duplicate (double safety)
        if (errorMsg.toLowerCase().includes('already exists')) {
          duplicateCount++;
        } else {
          toast.error(`Failed at row with "${holidayName}": ${errorMsg}`);
          failCount++;
        }
      }
    }

    toast.dismiss('importLoader');

    if (successCount > 0) {
      toast.success(`Imported ${successCount} holidays`);
      fetchHolidays();
    }

    if (duplicateCount > 0) {
      toast(`${duplicateCount} duplicates were skipped`, { duration: 5000 });
    }

    if (failCount > 0) {
      toast.error(`${failCount} rows failed to import. Check console for details.`);
    }

    if (successCount === 0 && duplicateCount === 0 && failCount === 0) {
      toast.error("No valid holiday data found in file.");
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        // remove header row
        processRows(rows.slice(1));
        event.target.value = null;
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Handle CSV as before
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) {
          toast.error("Invalid CSV format");
          return;
        }

        const parseCSVLine = (line) => {
          const result = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') inQuotes = !inQuotes;
            else if (c === ',' && !inQuotes) {
              result.push(cur.trim());
              cur = '';
            } else {
              cur += c;
            }
          }
          result.push(cur.trim());
          return result;
        };

        const dataRows = lines.slice(1).map(line => parseCSVLine(line));
        processRows(dataRows);
        event.target.value = null;
      };
      reader.readAsText(file);
    }
  };

  const filteredHolidays = holidays.filter(holiday =>
    holiday.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to split holidays
  const getCategorizedHolidays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = filteredHolidays
      .filter(h => new Date(h.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const past = filteredHolidays
      .filter(h => new Date(h.date) < today)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return { upcoming, past };
  };

  const { upcoming, past } = getCategorizedHolidays();
  const displayHolidays = viewMode === 'upcoming' ? upcoming : past;  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
  };

  const getDayName = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const calendarEvents = holidays.map(h => ({
    date: h.date,
    title: h.name,
    type: 'holiday'
  }));

  // Live Countdown Sub-component
  const NextHolidayCountdown = () => {
    const [timeLeft, setTimeLeft] = useState(null);
    const [nextHoliday, setNextHoliday] = useState(null);

    useEffect(() => {
      const calculateTimeLeft = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const futureHolidays = holidays
          .filter(h => new Date(h.date) >= today)
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (futureHolidays.length === 0) {
          setTimeLeft(null);
          setNextHoliday(null);
          return;
        }

        const target = futureHolidays[0];
        setNextHoliday(target);

        const targetDate = new Date(target.date);
        targetDate.setHours(0, 0, 0, 0);
        const difference = targetDate - new Date();

        if (difference <= 0) {
          setTimeLeft({ days: 0, isToday: true });
          return;
        }

        const days = Math.ceil(difference / (1000 * 60 * 60 * 24));
        setTimeLeft({ days, isToday: false });
      };

      calculateTimeLeft();
    }, [holidays]);

    if (!nextHoliday || !timeLeft) return null;

    return (
      <section className="hl-countdown" aria-label="Next holiday">
        <div className="hl-countdown-main">
          <span className="hl-countdown-eyebrow">
            <Sparkles size={14} aria-hidden />
            {timeLeft.isToday ? 'Holiday today' : 'Next holiday'}
          </span>
          <h2 className="hl-countdown-title">{nextHoliday.name}</h2>
          <p className="hl-countdown-meta">
            <Calendar size={16} aria-hidden />
            {new Date(nextHoliday.date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
            {nextHoliday.region && nextHoliday.region !== 'All' && (
              <span className="hl-region specific">{nextHoliday.region}</span>
            )}
          </p>
        </div>
        {timeLeft.isToday ? (
          <div className="hl-countdown-today">Enjoy your day off</div>
        ) : (
          <div className="hl-days-left" aria-live="polite">
            <span className="hl-days-val">{timeLeft.days}</span>
            <span className="hl-days-lbl">{timeLeft.days === 1 ? 'day left' : 'days left'}</span>
          </div>
        )}
      </section>
    );
  };

  const totalCount = holidays.length;
  const publicCount = holidays.filter(h => (h.type || 'Public Holiday') === 'Public Holiday').length;
  const restrictedCount = holidays.filter(h => (h.type || 'Public Holiday') === 'Restricted Holiday').length;
  const upcomingCount = upcoming.length;

  const openAddModal = () => {
    setIsEditing(false);
    setEditId(null);
    setShowAddModal(true);
    setNewHoliday({ name: '', date: '', day: '', type: 'Public Holiday', region: 'All', isOptional: false, selectionDeadline: '' });
  };

  const renderHolidayCard = (holiday) => {
    const dateObj = new Date(holiday.date);
    const monthIndex = dateObj.getMonth();
    const isRestricted = holiday.type === 'Restricted Holiday';
    const isOptional = holiday.isOptional;

    return (
      <article key={holiday.id || holiday._id} className="hl-card">
        <div className="hl-card-media">
          <HolidayImage name={holiday.name} monthIndex={monthIndex} />
          <div className="hl-card-media-overlay" aria-hidden />
          <div className="hl-card-badges">
            <span className={`hl-type-badge ${isOptional ? 'optional' : (isRestricted ? 'restricted' : '')}`}>
              {isOptional ? 'Optional Holiday' : (holiday.type || 'Public Holiday')}
            </span>
            <div className="hl-date-pill">
              <div className="hl-date-pill-month">
                {dateObj.toLocaleDateString('en-US', { month: 'short' })}
              </div>
              <div className="hl-date-pill-day">
                {dateObj.getDate()}
                <span className="hl-date-pill-dow">
                  {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="hl-card-body">
          <div>
            <h3 className="hl-card-title">{holiday.name}</h3>
            <div className="hl-card-meta">
              <span>{holiday.day || getDayName(holiday.date)}</span>
              <span className={`hl-region ${holiday.region && holiday.region !== 'All' ? 'specific' : ''}`}>
                {holiday.region || 'All regions'}
              </span>
            </div>
          </div>
          {hasAdminAccess() && (
            <div className="hl-card-actions">
              <button type="button" className="hl-edit" onClick={() => handleEditClick(holiday)}>
                <Edit2 size={14} aria-hidden /> Edit
              </button>
              <button type="button" className="hl-delete" onClick={() => handleDeleteHoliday(holiday.id || holiday._id)}>
                <Trash2 size={14} aria-hidden /> Delete
              </button>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="main-content holidays-page">
      <Header
        title="Holidays"
        subtitle="Company calendar, upcoming days off, and regional observances"
      />

      <div className="page-content" style={{ padding: '14px 16px 20px' }}>
        <div className="hl-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="hl-stat">
            <div className="hl-stat-icon indigo"><Calendar size={20} aria-hidden /></div>
            <div>
              <div className="hl-stat-lbl">Total</div>
              <div className="hl-stat-val">{totalCount}</div>
            </div>
          </div>
          <div className="hl-stat">
            <div className="hl-stat-icon cyan"><CalendarIcon size={20} aria-hidden /></div>
            <div>
              <div className="hl-stat-lbl">Public</div>
              <div className="hl-stat-val">{publicCount}</div>
            </div>
          </div>
          <div className="hl-stat">
            <div className="hl-stat-icon green"><Sparkles size={20} aria-hidden /></div>
            <div>
              <div className="hl-stat-lbl">Upcoming</div>
              <div className="hl-stat-val">{upcomingCount}</div>
            </div>
          </div>
          {(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const futureHolidays = holidays
              .filter(h => new Date(h.date) >= today)
              .sort((a, b) => new Date(a.date) - new Date(b.date));

            if (futureHolidays.length === 0) return null;
            const nextH = futureHolidays[0];
            const targetDate = new Date(nextH.date);
            targetDate.setHours(0, 0, 0, 0);
            const diff = targetDate - today;
            const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));

            return (
              <div className="hl-stat" style={{ borderLeft: '3px solid #4f46e5' }}>
                <div className="hl-stat-icon indigo"><Clock size={20} aria-hidden /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="hl-stat-lbl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Next Holiday</span>
                    <span style={{ fontSize: '10px', color: '#4f46e5', fontWeight: 700 }}>{daysLeft === 0 ? 'Today' : `${daysLeft}d left`}</span>
                  </div>
                  <div className="hl-stat-val" style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={nextH.name}>
                    {nextH.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    {new Date(nextH.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="hl-toolbar">
          <div className="hl-toolbar-left">
            <div className="hl-search">
              <span className="hl-search-icon" aria-hidden>
                <Search size={18} />
              </span>
              <input
                type="search"
                className="hl-search-input"
                placeholder="Search holidays"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search holidays"
              />
            </div>
            {visualMode === 'grid' && (
              <div className="hl-segmented" role="tablist" aria-label="Time range">
                <button type="button" role="tab" className={`hl-seg-btn ${viewMode === 'upcoming' ? 'active' : ''}`} onClick={() => setViewMode('upcoming')}>
                  Upcoming
                </button>
                <button type="button" role="tab" className={`hl-seg-btn ${viewMode === 'past' ? 'active' : ''}`} onClick={() => setViewMode('past')}>
                  Past
                </button>
                {!hasAdminAccess() && (
                  <button type="button" role="tab" className={`hl-seg-btn ${viewMode === 'optional' ? 'active' : ''}`} onClick={() => setViewMode('optional')}>
                    Optional Holidays
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="hl-toolbar-right">
            <div className="hl-segmented" role="tablist" aria-label="View mode">
              <button type="button" className={`hl-seg-btn ${visualMode === 'grid' ? 'active' : ''}`} onClick={() => setVisualMode('grid')}>
                <LayoutGrid size={16} aria-hidden /> Grid
              </button>
              <button type="button" className={`hl-seg-btn ${visualMode === 'calendar' ? 'active' : ''}`} onClick={() => setVisualMode('calendar')}>
                <CalendarIcon size={16} aria-hidden /> Calendar
              </button>
              <button type="button" className={`hl-seg-btn ${visualMode === 'list' ? 'active' : ''}`} onClick={() => setVisualMode('list')}>
                <ListIcon size={16} aria-hidden /> List
              </button>
            </div>

            {hasAdminAccess() && (
              <div className="hl-actions-wrap" ref={actionsRef}>
                <button type="button" className="hl-btn-secondary" onClick={() => setShowImportExport(!showImportExport)}>
                  Actions <ChevronDown size={16} aria-hidden />
                </button>
                {showImportExport && (
                  <div className="hl-dropdown">
                    <button type="button" onClick={() => { downloadTemplate(); setShowImportExport(false); }}>
                      <FileText size={16} aria-hidden /> Download template
                    </button>
                    <button type="button" onClick={() => { fileInputRef.current?.click(); setShowImportExport(false); }}>
                      <Upload size={16} aria-hidden /> Import CSV / Excel
                    </button>
                    <button type="button" onClick={() => { handleExportCSV(); setShowImportExport(false); }}>
                      <Download size={16} aria-hidden /> Export holidays
                    </button>
                    <button type="button" onClick={() => { handleExportOptionalReport(); setShowImportExport(false); }}>
                      <Download size={16} aria-hidden /> Optional selections report
                    </button>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".csv,.xlsx,.xls" hidden />
              </div>
            )}

            {hasAdminAccess() && (
              <button type="button" className="hl-btn-primary" onClick={openAddModal}>
                <Plus size={18} aria-hidden /> Add holiday
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="hl-loading">
            <Loader2 className="animate-spin" size={32} />
            <p>Loading holidays...</p>
          </div>
        ) : error ? (
          <div className="hl-error">
            <p>{error}</p>
            <button type="button" className="hl-btn-primary" onClick={fetchHolidays}>Retry</button>
          </div>
        ) : visualMode === 'grid' ? (
          viewMode === 'optional' ? (
            <div className="hl-opt-container" style={{ width: '100%' }}>
              <div className="hl-quota-summary">
                <h2 className="hl-quota-title">Optional Holiday Quota</h2>
                <span className="hl-quota-val">
                  Selected {optionalHolidaysInfo.selectedCount} / {optionalHolidaysInfo.maxQuota}
                </span>
              </div>
              <div className="hl-quota-progress-container">
                <div 
                  className="hl-quota-progress-bar" 
                  style={{ width: `${Math.min(100, (optionalHolidaysInfo.selectedCount / (optionalHolidaysInfo.maxQuota || 1)) * 100)}%` }} 
                />
              </div>
              
              {loadingOptional ? (
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto' }} />
                </div>
              ) : optionalHolidaysInfo.holidays.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--hl-muted)' }}>
                  No optional holidays defined for this year.
                </div>
              ) : (
                <div className="hl-opt-grid">
                  {optionalHolidaysInfo.holidays.map(holiday => {
                    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
                    const isSelected = holiday.selected;
                    const deadlinePassed = holiday.selectionDeadline && todayStr > holiday.selectionDeadline;
                    const holidayPassed = todayStr >= holiday.date;
                    const disabled = (optionalHolidaysInfo.quotaConsumed >= optionalHolidaysInfo.maxQuota && !isSelected && !holiday.previouslySelected) || deadlinePassed || holidayPassed;

                    return (
                      <div key={holiday.id} className={`hl-opt-card ${isSelected ? 'selected' : ''}`}>
                        <div className="hl-opt-card-body">
                          <h3 className="hl-opt-title">{holiday.name}</h3>
                          <p className="hl-opt-date">{formatDate(holiday.date)}</p>
                          {holiday.selectionDeadline && (
                            <p className="hl-opt-deadline" style={{ color: deadlinePassed ? '#ef4444' : 'var(--hl-muted)' }}>
                              Deadline: {formatDate(holiday.selectionDeadline)}
                            </p>
                          )}
                        </div>
                        <div className="hl-opt-card-action">
                          <button
                            type="button"
                            disabled={disabled || isSelected}
                            onClick={() => handleOptionalHolidayToggle(holiday.id, isSelected)}
                            className={`hl-opt-btn ${isSelected ? 'selected' : ''}`}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="hl-grid">
              {displayHolidays.length === 0 ? (
                <div className="hl-empty">
                  <Calendar size={40} style={{ opacity: 0.4, margin: '0 auto 12px' }} aria-hidden />
                  <p>No holidays found.</p>
                  {hasAdminAccess() && (
                    <button type="button" className="hl-btn-primary" style={{ marginTop: 16 }} onClick={openAddModal}>
                      <Plus size={16} aria-hidden /> Add first holiday
                    </button>
                  )}
                </div>
              ) : (
                displayHolidays.map(renderHolidayCard)
              )}
            </div>
          )
        ) : visualMode === 'calendar' ? (
          <div className="hl-calendar-panel">
            <SmartCalendar events={calendarEvents} />
          </div>
        ) : (
          <div className="hl-table-wrap">
            <table className="hl-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Holiday</th>
                  <th>Type</th>
                  <th>Region</th>
                  {hasAdminAccess() && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={hasAdminAccess() ? 6 : 5} style={{ textAlign: 'center', padding: 20, color: 'var(--hl-muted)' }}>
                      No holidays found.
                    </td>
                  </tr>
                ) : (
                  displayHolidays.map((holiday) => {
                    const dateObj = new Date(holiday.date);
                    const isRestricted = holiday.type === 'Restricted Holiday';
                    return (
                      <tr key={holiday.id || holiday._id}>
                        <td style={{ fontWeight: 600 }}>{formatDate(holiday.date)}</td>
                        <td>{holiday.day || getDayName(holiday.date)}</td>
                        <td>
                          <div className="hl-table-name">
                            <HolidayImage name={holiday.name} monthIndex={dateObj.getMonth()} className="hl-table-thumb" />
                            <span style={{ fontWeight: 600 }}>{holiday.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`hl-type-badge ${holiday.isOptional ? 'optional' : (isRestricted ? 'restricted' : '')}`}>
                            {holiday.isOptional ? 'Optional Holiday' : (holiday.type || 'Public Holiday')}
                          </span>
                        </td>
                        <td>
                          <span className={`hl-region ${holiday.region && holiday.region !== 'All' ? 'specific' : ''}`}>
                            {holiday.region || 'All'}
                          </span>
                        </td>
                        {hasAdminAccess() && (
                          <td>
                            <div className="hl-table-actions">
                              <button type="button" className="hl-icon-btn" onClick={() => handleEditClick(holiday)} title="Edit">
                                <Edit2 size={16} />
                              </button>
                              <button type="button" className="hl-icon-btn danger" onClick={() => handleDeleteHoliday(holiday.id || holiday._id)} title="Delete">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="hl-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="hl-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="hl-modal-title">
            <button type="button" className="hl-modal-close" onClick={() => setShowAddModal(false)} aria-label="Close">
              <X size={20} />
            </button>
            <h2 id="hl-modal-title" className="hl-modal-title">
              {isEditing ? 'Edit holiday' : 'Add holiday'}
            </h2>
            <form onSubmit={handleAddHoliday}>
              <div className="hl-field">
                <label htmlFor="hl-name">Holiday name</label>
                <input id="hl-name" type="text" placeholder="e.g. Independence Day" required value={newHoliday.name} onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })} />
              </div>
              <div className="hl-field">
                <label htmlFor="hl-date">Date</label>
                <input id="hl-date" type="date" required value={newHoliday.date} onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })} onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }} />
              </div>
              <div className="hl-field-row">
                <div className="hl-field">
                  <label htmlFor="hl-type">Type</label>
                  <select id="hl-type" value={newHoliday.type} onChange={(e) => setNewHoliday({ ...newHoliday, type: e.target.value })}>
                    <option value="Public Holiday">Public Holiday</option>
                    <option value="Restricted Holiday">Restricted Holiday</option>
                  </select>
                </div>
                <div className="hl-field">
                  <label htmlFor="hl-region">Region</label>
                  <select id="hl-region" value={newHoliday.region} onChange={(e) => setNewHoliday({ ...newHoliday, region: e.target.value })}>
                    <option value="All">All regions</option>
                    <option value="Corporate Office">Corporate Office</option>
                    <option value="Main Branch">Main Branch</option>
                    <option value="R&D Center">R&D Center</option>
                  </select>
                </div>
              </div>
              <div className="hl-field-checkbox">
                <input 
                  id="hl-is-optional" 
                  type="checkbox" 
                  checked={newHoliday.isOptional || false} 
                  onChange={(e) => setNewHoliday({ ...newHoliday, isOptional: e.target.checked })} 
                />
                <label htmlFor="hl-is-optional">Optional Holiday (selectable by employees)</label>
              </div>
              {newHoliday.isOptional && (
                <div className="hl-field">
                  <label htmlFor="hl-deadline">Selection Deadline</label>
                  <input 
                    id="hl-deadline" 
                    type="date" 
                    value={newHoliday.selectionDeadline || ''} 
                    onChange={(e) => setNewHoliday({ ...newHoliday, selectionDeadline: e.target.value })} 
                    onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                  />
                </div>
              )}
              <div className="hl-modal-actions">
                <button type="button" className="hl-modal-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="hl-modal-submit" disabled={submitting}>
                  {submitting && <Loader2 size={16} className="animate-spin" aria-hidden />}
                  {isEditing ? 'Save changes' : 'Create holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}