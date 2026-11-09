import {getDb} from '@/lib/server/mongo';
import {runMagick} from '@/lib/server/imagemagick';

async function check(probe) {
  try {
    await probe();
    return true;
  } catch (error) {
    console.error('Health check failed:', error.message);
    return false;
  }
}

// Development-only check that the Docker services are reachable.
export async function GET() {
  if (process.env.NODE_ENV === 'production') return new Response(null, {status: 404});

  const [mongo, elasticsearch, imagemagick] = await Promise.all([
    check(async () => (await getDb()).command({ping: 1})),
    check(async () => {
      const response = await fetch(`${process.env.ELASTICSEARCH_URL}/_cluster/health`);
      if (!response.ok) throw new Error(`Elasticsearch answered ${response.status}`);
    }),
    check(() => runMagick(['-version']))
  ]);

  return Response.json({mongo, elasticsearch, imagemagick});
}
