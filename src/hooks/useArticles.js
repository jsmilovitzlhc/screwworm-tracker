import { useState, useEffect } from 'react';

export default function useArticles() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          'https://www.meatingplace.com/wp-json/wp/v2/posts?search=screwworm&per_page=10&_fields=title,link,date,excerpt',
          { headers: { 'User-Agent': 'MeatingplaceSEOAgent/1.0' } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setArticles(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { articles, loading, error };
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

export function formatShortDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

export function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}
