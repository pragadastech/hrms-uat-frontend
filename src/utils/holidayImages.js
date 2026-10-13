export const DEFAULT_HOLIDAY_IMAGE =
  'https://images.unsplash.com/photo-1514525253440-b393452e8d26?w=800&auto=format&fit=crop&q=80';

/** Local assets in public/holidays/ (served at /holidays/...) */
export function getLocalHolidayImage(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('diwali') || n.includes('deepavali')) return '/holidays/diwali.png';
  if (n.includes('holi')) return '/holidays/holi.png';
  if (n.includes('sankranti') || n.includes('pongal') || n.includes('lohri') || n.includes('bihu')) {
    return '/holidays/sankranti.png';
  }
  if (n.includes('eid') || n.includes('ramadan')) return '/holidays/eid.png';
  if (n.includes('dussehra') || n.includes('dasara') || n.includes('durga') || n.includes('navratri')) {
    return '/holidays/dussehra.png';
  }
  if (n.includes('ganesh') || n.includes('vinayaka')) return '/holidays/ganesh_chaturthi.png';
  if (n.includes('raksha') || n.includes('rakhi')) return '/holidays/rakhi.png';
  if (n.includes('ugadi') || n.includes('gudi') || n.includes('padwa')) return '/holidays/ugadi.png';
  if (n.includes('good friday') || n.includes('easter')) return '/holidays/good_friday.png';
  if (n.includes('shivaratri') || n.includes('sivarathri')) return '/holidays/shivaratri.png';
  if (n.includes('republic') || n.includes('independence')) return '/holidays/independence.png';
  if (n.includes('gandhi')) return '/holidays/gandhi.png';
  if (n.includes('ambedkar')) return '/holidays/ambedkar.png';
  if (n.includes('christmas') || n.includes('xmas')) return '/holidays/christmas.png';
  if (n.includes('onam')) return '/holidays/onam.png';
  if (n.includes('janmashtami') || n.includes('krishna')) return '/holidays/janmashtami.png';
  if (n.includes('labor') || n.includes('labour') || n.includes('may day')) return '/holidays/labor.png';
  if (n.includes('new year') || n.includes('31st')) return '/holidays/new_year.png';
  return null;
}

export function getRemoteHolidayImageUrl(name) {
  return null;
}

export function getHolidayImageUrl(name) {
  return getLocalHolidayImage(name) || getRemoteHolidayImageUrl(name) || DEFAULT_HOLIDAY_IMAGE;
}
