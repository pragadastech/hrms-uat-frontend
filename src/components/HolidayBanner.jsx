import { useState, useEffect } from 'react';
import {
  DEFAULT_HOLIDAY_IMAGE,
  getHolidayImageUrl,
  getLocalHolidayImage,
  getRemoteHolidayImageUrl,
} from '../utils/holidayImages';

function formatDaysLeft(days) {
  if (days === 0) return 'Today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export default function HolidayBanner({ name, dateStr, daysLeft, onClick, className = '' }) {
  const localSrc = getLocalHolidayImage(name);
  const remoteSrc = getRemoteHolidayImageUrl(name);
  const [src, setSrc] = useState(() => getHolidayImageUrl(name));

  useEffect(() => {
    setSrc(getHolidayImageUrl(name));
  }, [name]);

  const handleError = () => {
    if (localSrc && src === localSrc && remoteSrc) {
      setSrc(remoteSrc);
      return;
    }
    if (src !== DEFAULT_HOLIDAY_IMAGE) {
      setSrc(DEFAULT_HOLIDAY_IMAGE);
    }
  };

  const d = dateStr ? new Date(dateStr) : null;
  const dateLabel =
    d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : '';

  return (
    <div
      className={`holiday-banner ${className}`.trim()}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick(e) : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <img src={src} alt="" className="holiday-banner-bg" onError={handleError} />
      <div className="holiday-banner-shade" aria-hidden="true" />
      <div className="holiday-banner-body">
        <span className="holiday-banner-days">{formatDaysLeft(daysLeft)}</span>
        <span className="holiday-banner-name">{name}</span>
        {dateLabel ? <span className="holiday-banner-date">{dateLabel}</span> : null}
      </div>
    </div>
  );
}
