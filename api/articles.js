export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(
      'https://www.meatingplace.com/wp-json/wp/v2/posts?search=screwworm&per_page=10&_fields=title,link,date,excerpt',
      {
        headers: {
          'User-Agent': 'MeatingplaceSEOAgent/1.0',
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Meatingplace API returned ${response.status}`);
    }

    const articles = await response.json();

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json(articles);
  } catch (err) {
    console.error('Error fetching articles:', err);
    return res.status(502).json({ error: 'Failed to fetch articles from Meatingplace' });
  }
}
