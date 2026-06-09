import { useState, useEffect } from 'react';

export default function NewsFeed() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch(
          'https://www.meatingplace.com/wp-json/wp/v2/posts?search=screwworm&per_page=10&_fields=title,link,date,excerpt',
          { headers: { 'User-Agent': 'MeatingplaceSEOAgent/1.0' } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setArticles(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const stripHtml = (html) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <div className="content-section">
      <div className="news-section-highlight">
        <div className="section-header">
          <span className="section-icon">📰</span>
          <h3>More from Meatingplace</h3>
        </div>
        {loading && <div className="news-loading">Loading coverage…</div>}
        {error && (
          <div className="news-error">
            Unable to load articles.{' '}
            <a href="https://www.meatingplace.com/?s=screwworm" target="_blank" rel="noopener noreferrer">
              View on Meatingplace.com →
            </a>
          </div>
        )}
        {!loading && !error && articles.length === 0 && (
          <div className="news-error">No articles found.</div>
        )}
        <div className="news-grid">
          {articles.map((article, i) => (
            <a
              key={i}
              href={article.link}
              className="news-card"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="news-date">{formatDate(article.date)}</div>
              <div className="news-title">{stripHtml(article.title.rendered)}</div>
              <div className="news-excerpt">{stripHtml(article.excerpt.rendered).slice(0, 180)}…</div>
              <span className="news-link">Read on Meatingplace →</span>
            </a>
          ))}
        </div>
        <a
          href="https://www.meatingplace.com/?s=screwworm"
          className="news-view-all"
          target="_blank"
          rel="noopener noreferrer"
        >
          View All Screwworm Coverage →
        </a>
      </div>
    </div>
  );
}
