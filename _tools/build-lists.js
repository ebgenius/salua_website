/*
 * Static-site build step. Run before committing:
 *
 *   node _tools/build-lists.js
 *
 * It does four things:
 *   1. Injects the shared page chrome (head, nav, footer, scripts) from
 *      _tools/partials/ into every page, so the nav can never drift between
 *      pages. Nav anchors are rewritten to "/#section" on sub-pages.
 *   2. Renders data/news.json and data/publications.json into each page, so
 *      both lists are in the served HTML for crawlers that do not run
 *      JavaScript (Bing, LinkedIn/X preview bots, AI crawlers). The same
 *      markup is produced at runtime by assets/js/lists.js — keep them in step.
 *   3. Generates the publications JSON-LD graph on the homepage.
 *   4. Regenerates sitemap.xml, bumping lastmod only for pages that changed.
 *
 * Lives under an underscore so the GitHub Pages Jekyll build leaves it out of
 * the published site.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SITE = 'https://saluahamaza.eu';

const readJson = (f) => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8'));
const partial = (name) => fs.readFileSync(path.join(__dirname, 'partials', name + '.html'), 'utf8').replace(/\s+$/, '');

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Pages the build owns. `sub` pages get root-relative nav anchors.
const pages = [
  { file: 'index.html', loc: SITE + '/', sub: false },
  { file: 'news-archive/index.html', loc: SITE + '/news-archive/', sub: true },
  { file: 'research-archive/index.html', loc: SITE + '/research-archive/', sub: true },
];

// ------------------------------------------------------------------ rendering
const button = (url, label) => url
  ? '<a href="' + esc(url) + '" class="button small" target="_blank" rel="noopener noreferrer">' + label + '</a>'
  : '';

const row = (dateLabel, url, title, buttons, meta) => [
  '              <li>',
  '                <span class="list-date">' + dateLabel + '</span><div class="list-item">',
  '                  <a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"><p>' + title + '</p></a>',
  buttons ? '                  <div class="list-buttons">' + buttons + '</div>' : '',
  meta ? '                  <span class="list-meta">' + meta + '</span>' : '',
  '                </div>',
  '              </li>',
].filter(Boolean).join('\n');

const newsRow = (item) => {
  const btns = [
    button(item.article, 'Article'),
    button(item.video, 'Video'),
    button(item.linkedin, 'LinkedIn'),
  ].filter(Boolean).join(' ');
  // Split a leading "JUN '26 - " off the title so the date can be styled as a
  // label; titles without that prefix are left untouched.
  const m = item.title.match(/^([A-Za-z]{3} '\d{2})\s*-\s*([\s\S]+)$/);
  return row(m ? esc(m[1]) : '', item.url, esc(m ? m[2] : item.title), btns, '');
};

const publicationRow = (item) => {
  const btns = [
    button(item.pdf, 'PDF'),
    button(item.video, 'Video'),
    button(item.code, 'Code'),
  ].filter(Boolean).join(' ');
  const meta = [item.authors, item.venue].filter(Boolean).map(esc).join(' &middot; ');
  return row(esc(item.year || ''), item.url, esc(item.title), btns, meta);
};

const news = readJson('news.json');
const publications = readJson('publications.json');
const currentNews = news.filter((n) => n.archived !== true);
const archivedNews = news.filter((n) => n.archived === true);

// Only offer the archive link once something is actually archived.
const archiveLink = archivedNews.length
  ? '              <p class="list-more"><a href="/news-archive/">News archive &rarr;</a></p>'
  : '';

// ------------------------------------------------ publications JSON-LD graph
// Each paper becomes a ScholarlyArticle node. Where Salua is an author the node
// points at the Person @id in the main graph, so the two blocks join into one
// graph: "this person wrote these works".
const PERSON_ID = SITE + '/#person';
const SELF = 'Salua Hamaza';

// "authors" is a comma-separated list in "First Last" order — keep it that way,
// or a name written "Last, First" will be split into two people.
const authorNodes = (authors) => String(authors || '')
  .split(',')
  .map((a) => a.trim())
  .filter(Boolean)
  .map((name) => (name === SELF ? { '@id': PERSON_ID } : { '@type': 'Person', name }));

const doiOf = (url) => {
  const m = /(?:doi\.org\/)(10\.[^\s"?#]+)/.exec(url || '');
  return m ? m[1] : '';
};

const articleNodes = publications.map((item) => {
  const doi = doiOf(item.url);
  const node = {
    '@type': 'ScholarlyArticle',
    '@id': item.url,
    name: item.title,
    headline: item.title,
    author: authorNodes(item.authors),
  };
  if (item.year) node.datePublished = String(item.year);
  if (item.venue) {
    // Periodical is only right for journals; proceedings are plain CreativeWorks.
    const isProceedings = /conference|proceedings|symposium|workshop/i.test(item.venue);
    node.isPartOf = { '@type': isProceedings ? 'CreativeWork' : 'Periodical', name: item.venue };
  }
  if (doi) node.identifier = { '@type': 'PropertyValue', propertyID: 'DOI', value: doi };
  if (item.url) node.url = item.url;
  // No "video": its range is VideoObject, and a bare URL there is a range
  // violation. The link still reaches readers through the page's Video button.
  return node;
});

const ldJson = JSON.stringify({ '@context': 'https://schema.org', '@graph': articleNodes }, null, 2)
  .replace(/</g, '\\u003C')   // can never terminate the <script> early
  .split('\n')
  .map((line, i) => (i === 0 ? line : '    ' + line))
  .join('\n');

const publicationsLd = '  <script type="application/ld+json">\n    ' + ldJson + '\n  </script>';

// -------------------------------------------------------------------- blocks
// name -> replacement. A page only needs the markers it actually uses.
const blocks = {
  'head-common': partial('head-common'),
  nav: partial('nav'),
  footer: partial('footer'),
  scripts: partial('scripts'),
  news: currentNews.map(newsRow).join('\n'),
  'news-archived': archivedNews.map(newsRow).join('\n'),
  'news-more': archiveLink,
  publications: publications.map(publicationRow).join('\n'),
  'publications-ld': publicationsLd,
};

function fill(html, name, body, sub) {
  const start = '<!-- ' + name + ':start -->';
  const end = '<!-- ' + name + ':end -->';
  if (html.indexOf(start) === -1) return html;   // page doesn't use this block
  if (html.indexOf(end) === -1) {
    console.error('Missing ' + end + ' to match ' + start);
    process.exit(1);
  }
  // Sub-pages point their nav at the homepage's sections.
  const content = (name === 'nav' && sub) ? body.replace(/href="#/g, 'href="/#') : body;
  const re = new RegExp(start + '[\\s\\S]*?' + end);
  // Rendered rows carry their own indentation; partials start at column 0.
  const isList = ['news', 'news-archived', 'publications', 'news-more'].includes(name);
  const indent = isList ? '              ' : '  ';
  const firstLine = isList ? '' : indent;
  return html.replace(re, start + (content ? '\n' + firstLine + content + '\n' + indent : '\n' + indent) + end);
}

// --------------------------------------------------------------------- write
const changedPages = [];

for (const page of pages) {
  const file = path.join(root, page.file);
  if (!fs.existsSync(file)) {
    console.error('Missing page: ' + page.file);
    process.exit(1);
  }
  const before = fs.readFileSync(file, 'utf8');
  let html = before;
  for (const name of Object.keys(blocks)) html = fill(html, name, blocks[name], page.sub);
  if (html !== before) {
    fs.writeFileSync(file, html);
    changedPages.push(page.loc);
  }
}

console.log('Rendered ' + currentNews.length + ' news items, ' + archivedNews.length
  + ' archived and ' + publications.length + ' publications across ' + pages.length + ' pages'
  + (changedPages.length ? '' : ' (no change)'));

// ------------------------------------------------------------------- sitemap
// Keep each page's lastmod at the date its content last actually changed.
const sitemapPath = path.join(root, 'sitemap.xml');
const today = new Date().toISOString().slice(0, 10);
const previous = {};
if (fs.existsSync(sitemapPath)) {
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const re = /<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g;
  let m;
  while ((m = re.exec(xml))) previous[m[1]] = m[2];
}

const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + pages.map((page) => {
    const lastmod = changedPages.includes(page.loc) ? today : (previous[page.loc] || today);
    return '  <url>\n'
      + '    <loc>' + page.loc + '</loc>\n'
      + '    <lastmod>' + lastmod + '</lastmod>\n'
      + '    <changefreq>monthly</changefreq>\n'
      + '    <priority>' + (page.sub ? '0.5' : '1.0') + '</priority>\n'
      + '  </url>';
  }).join('\n')
  + '\n</urlset>\n';

const sitemapBefore = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : '';
if (sitemap !== sitemapBefore) {
  fs.writeFileSync(sitemapPath, sitemap);
  console.log('Updated sitemap.xml (' + pages.length + ' urls)');
}
