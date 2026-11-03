'use client';

import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';

export default function SiteHeader() {
  const {user, loading, signOut} = useAuth();

  return (
    <header className='site-header'>
      <Link href='/' className='brand'>
        Marketplace
      </Link>
      <nav aria-label='Account'>
        {loading ? null : user ? (
          <>
            <span>{user.displayName || user.email}</span>
            <button type='button' onClick={signOut}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href='/login'>Log in</Link>
            <Link href='/signup'>Sign up</Link>
          </>
        )}
      </nav>
    </header>
  );
}
