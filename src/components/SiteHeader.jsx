'use client';

import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {ROUTES} from '@/lib/routes';

const SIGNED_IN_LINKS = [
  {href: ROUTES.inbox, label: 'Inbox'},
  {href: ROUTES.watchlist, label: 'Watchlist'},
  {href: ROUTES.notifications, label: 'Notifications'}
];

function NavLink({href, pathname, children}) {
  const current = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} className='nav-link' aria-current={current ? 'page' : undefined}>
      {children}
    </Link>
  );
}

function AccountMenu({user, onSignOut}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && wrapper.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const name = user.displayName || user.email;

  return (
    <div className='account' ref={wrapper}>
      <button
        type='button'
        className='account-button'
        aria-expanded={open}
        aria-controls='account-menu'
        onClick={() => setOpen(!open)}
      >
        <span className='avatar' aria-hidden='true'>
          {(name || '?').trim().charAt(0).toUpperCase()}
        </span>
        <span className='account-name'>{name}</span>
      </button>
      <div id='account-menu' className='account-menu' hidden={!open}>
        <p className='account-menu-email'>{user.email}</p>
        <Link href={ROUTES.myProfile} onClick={() => setOpen(false)}>
          Your profile
        </Link>
        <button type='button' onClick={onSignOut}>
          Log out
        </button>
      </div>
    </div>
  );
}

export default function SiteHeader() {
  const {user, loading, signOut} = useAuth();
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    router.push(ROUTES.home);
  };

  const sellHref = user ? ROUTES.sell : `${ROUTES.login}?next=${encodeURIComponent(ROUTES.sell)}`;

  return (
    <header className='site-header'>
      <div className='page site-header-inner'>
        <Link href={ROUTES.home} className='wordmark'>
          Marketplace
        </Link>

        <form className='header-search' role='search' action={ROUTES.search} method='get'>
          <label htmlFor='site-search' className='sr-only'>
            Search listings
          </label>
          <input id='site-search' type='search' name='q' placeholder='Search listings' autoComplete='off' />
          <button type='submit'>Search</button>
        </form>

        <button
          type='button'
          className='btn btn-quiet menu-toggle'
          aria-expanded={menuOpen}
          aria-controls='site-nav'
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>

        <nav id='site-nav' className='site-nav' aria-label='Main' data-open={menuOpen}>
          {!loading &&
            user &&
            SIGNED_IN_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} pathname={pathname}>
                {link.label}
              </NavLink>
            ))}
          {!loading && !user && (
            <NavLink href={ROUTES.login} pathname={pathname}>
              Log in
            </NavLink>
          )}
          <Link href={sellHref} className='btn btn-primary'>
            Sell an item
          </Link>
          {!loading && !user && (
            <Link href={ROUTES.signup} className='btn btn-quiet'>
              Sign up
            </Link>
          )}
          {!loading && user && <AccountMenu user={user} onSignOut={handleSignOut} />}
        </nav>
      </div>
    </header>
  );
}
