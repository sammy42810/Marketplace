import Link from 'next/link';

// Placeholder until the home feed (search and browse) is built.
export default function HomePage() {
  return (
    <section>
      <h1>Marketplace</h1>
      <p>Buy, sell, trade and auction used items near you.</p>
      <p>
        <Link href='/status'>Check your setup</Link>
      </p>
    </section>
  );
}
