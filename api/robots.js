// api/robots.js — robots.txt dynamique
const SITE_URL = process.env.SITE_URL || 'https://claimyourjob.fr';

module.exports = (req, res) => {
  const content = `User-agent: *
Allow: /

# Pages de pagination (indexables)
Allow: /claim-job-board.html?page=

# Sitemap
Sitemap: ${SITE_URL}/sitemap.xml
`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400');
  res.status(200).send(content);
};
