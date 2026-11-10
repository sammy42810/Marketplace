export const ROUTES = {
  home: '/',
  search: '/search',
  sell: '/listings/new',
  listing: (id) => `/listings/${id}`,
  category: (category) => `/search?category=${encodeURIComponent(category)}`,
  inbox: '/inbox',
  watchlist: '/watchlist',
  notifications: '/notifications',
  profile: (id) => `/users/${id}`,
  myProfile: '/users/me',
  login: '/login',
  signup: '/signup'
};
