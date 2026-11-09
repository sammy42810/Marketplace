export const ROUTES = {
  home: '/',
  search: '/search',
  sell: '/listings/new',
  listing: (id) => `/listings/${id}`,
  category: (category) => `/search?category=${encodeURIComponent(category)}`,
  inbox: '/inbox',
  watchlist: '/watchlist',
  notifications: '/notifications',
  profile: (uid) => `/users/${uid}`,
  login: '/login',
  signup: '/signup'
};
