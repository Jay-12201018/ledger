const PATHS = {
  list: '<path d="M8 7h11M8 12h11M8 17h11"/><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
  pie: '<path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12V3.5z"/><path d="M14 4.2A8.5 8.5 0 0 1 19.8 10H14V4.2z"/>',
  wallet: '<rect x="3" y="6.5" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M16 14.5h2.2"/>',
  user: '<circle cx="12" cy="8" r="3.2"/><path d="M5.2 19.2a6.8 6.8 0 0 1 13.6 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  utensils: '<path d="M6 3.5v6.2a2 2 0 0 0 2 2V3.5M8 11.7V20"/><path d="M6 3.5v3M10 3.5v3"/><path d="M16 3.5c1.8 2.4 2.6 4 2.6 6.2 0 1.6-1.2 2.6-2.6 2.6V20"/>',
  bus: '<rect x="4.5" y="4" width="15" height="12.5" rx="2"/><path d="M4.5 12h15"/><path d="M7.5 16.5v2M16.5 16.5v2"/><path d="M7.2 9h.01M16.8 9h.01"/>',
  book: '<path d="M12 6.2C10.6 5 8.8 4.4 6.5 4.4H4.5V18h2.2c2 0 3.6.5 5.3 1.6"/><path d="M12 6.2c1.4-1.2 3.2-1.8 5.5-1.8h2v13.6h-2.2c-2 0-3.6.5-5.3 1.6"/>',
  film: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4"/>',
  bag: '<path d="M6.5 8h11l-.8 11.2a1 1 0 0 1-1 .8H8.3a1 1 0 0 1-1-.8L6.5 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
  medical: '<path d="M12 7v10M7 12h10"/>',
  more: '<circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  gift: '<rect x="4" y="11" width="16" height="8.5" rx="1"/><path d="M12 11v8.5M4 11V8.5h16V11"/><path d="M12 8.5c-1.6 0-2.6-1.6-1.8-2.6.7-.8 1.8.2 1.8.8.0-.6 1.1-1.6 1.8-.8.8 1-0.2 2.6-1.8 2.6z"/>',
  briefcase: '<rect x="3.5" y="8" width="17" height="11" rx="2"/><path d="M9 8V6.2A1.2 1.2 0 0 1 10.2 5h3.6A1.2 1.2 0 0 1 15 6.2V8M3.5 12.5h17"/>',
  award: '<circle cx="12" cy="9" r="4.2"/><path d="M9.2 12.6 8 20l4-2.2L16 20l-1.2-7.4"/>',
  coffee: '<path d="M5 8h10v5.5a3.5 3.5 0 0 1-3.5 3.5h-3A3.5 3.5 0 0 1 5 13.5V8z"/><path d="M15 9h2.2a2.2 2.2 0 0 1 0 4.4H15"/><path d="M8 4.5v2M11.5 4.5v2"/>',
  cart: '<path d="M4 5h2.2l1.6 11h9.4l1.8-7.5H8"/><circle cx="10" cy="19" r="1.1" fill="currentColor" stroke="none"/><circle cx="17" cy="19" r="1.1" fill="currentColor" stroke="none"/>',
  home: '<path d="M4 11.2 12 4.5l8 6.7"/><path d="M7 10.5V19h10v-8.5"/>',
  music: '<path d="M9 17.5a2.5 2.5 0 1 0-2.5-2.5V6.5L18 4.5v8"/><circle cx="15.5" cy="14.5" r="2.5"/>',
  game: '<path d="M8 10h8a4 4 0 0 1 4 4v.5a3.5 3.5 0 0 1-3.5 3.5H16l-1.5-2h-5L8 18H7.5A3.5 3.5 0 0 1 4 14.5V14a4 4 0 0 1 4-4z"/><path d="M9 12.5v3M7.5 14h3"/><path d="M16.2 13h.01M17.6 14.6h.01"/>',
  heart: '<path d="M12 19.5s-6.2-3.8-6.2-8A3.4 3.4 0 0 1 12 9a3.4 3.4 0 0 1 6.2 2.5c0 4.2-6.2 8-6.2 8z"/>',
  phone: '<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M11 17.8h2"/>',
  shirt: '<path d="M8 6.5 12 8.2 16 6.5 20 9l-2 2.5h-2V19H8v-7.5H6L4 9l4-2.5z"/>',
  plane: '<path d="M3.5 12.2 20.5 6.5l-5.2 12.2-2.2-4.6-4.6-2z"/>',
  star: '<path d="m12 3.8 2.1 4.4 4.8.6-3.5 3.3.9 4.8L12 14.8 7.7 17l.9-4.8L5.1 8.8l4.8-.6L12 3.8z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3.5v3M16 3.5v3M4 9.5h16"/>',
  back: '<path d="M15 5.5 8.5 12 15 18.5"/>',
  close: '<path d="M7 7l10 10M17 7 7 17"/>',
  chevron: '<path d="m8 10 4 4 4-4"/>',
  chevR: '<path d="m10 7 5 5-5 5"/>',
  chevL: '<path d="m14 7-5 5 5 5"/>',
  trash: '<path d="M5 7.5h14"/><path d="M9.5 7.5V5.8h5V7.5"/><path d="M7.2 7.5l.7 11h8.2l.7-11"/>',
  pencil: '<path d="M4 16.8 14.8 6a1.6 1.6 0 0 1 2.2 2.2L6.2 19H4v-2.2z"/>',
  grip: '<path d="M7 7h10M7 12h10M7 17h10"/>',
  warning: '<path d="M12 4.2 21 19H3L12 4.2z"/><path d="M12 10v4.2"/><path d="M12 16.6h.01"/>',
  check: '<path d="M5.5 12.5 10 17l8.5-9"/>',
  download: '<path d="M12 4.5v10"/><path d="m8 11 4 4 4-4"/><path d="M5 19h14"/>',
  upload: '<path d="M12 19.5v-10"/><path d="m8 8 4-4 4 4"/><path d="M5 19h14"/>',
  smile: '<circle cx="12" cy="12" r="8"/><path d="M8.5 13.2c.8 1.6 2 2.4 3.5 2.4s2.7-.8 3.5-2.4"/><path d="M9 10h.01M15 10h.01"/>',
  backspace: '<path d="M7.2 6.5h11.2a1.4 1.4 0 0 1 1.4 1.4v8.2a1.4 1.4 0 0 1-1.4 1.4H7.2L3.2 12l4-5.5z"/><path d="m11 10 4 4M15 10l-4 4"/>',
  backup: '<path d="M7 16.5a3.5 3.5 0 0 1 .4-7 5 5 0 0 1 9.6 1.2A3.2 3.2 0 0 1 17 16.5"/><path d="M12 11.5v6"/><path d="m9.2 15 2.8 2.8L14.8 15"/>',
};

export const ICON_CHOICES = [
  'utensils', 'bus', 'book', 'film', 'bag', 'medical', 'coffee', 'cart',
  'home', 'music', 'game', 'heart', 'phone', 'shirt', 'plane', 'gift',
  'wallet', 'briefcase', 'award', 'star', 'more',
];

export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(PATHS, name);
}

export function svg(name, size = 24, sw = 1.8) {
  const p = PATHS[name] || PATHS.more;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
