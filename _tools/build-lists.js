/*
 * Renders data/news.json and data/publications.json into index.html, between the
 * news:start / news:end and publications:start / publications:end markers, so both
 * lists are present in the served HTML for crawlers that do not run JavaScript
 * (Bing, LinkedIn/X preview bots, AI crawlers).
 *
 * The page also re-renders both lists from the JSON at runtime, so edits show up
 * for visitors immediately. Run this before committing to keep the static copy in
 * sync, and to refresh the sitemap's lastmod:
 *
 *   node _tools/build-lists.js
 *
 * Lives under an underscore so the GitHub Pages Jekyll build leaves it out of the
 * published site.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8'));

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

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

// --------------------------------------------------------------------- news
const news = read('news.json').map((item) => {
  const btns = [
    button(item.article, 'Article'),
    button(item.video, 'Video'),
    button(item.linkedin, 'LinkedIn'),
  ].filter(Boolean).join(' ');
  // Split a leading "JUN '26 - " off the title so the date can be styled as a
  // label; titles without that prefix are left untouched. Keep this in step with
  // the runtime renderer in index.html.
  const m = item.title.match(/^([A-Za-z]{3} '\d{2})\s*-\s*([\s\S]+)$/);
  return row(m ? esc(m[1]) : '', item.url, esc(m ? m[2] : item.title), btns, '');
}).join('\n');

// ------------------------------------------------------------- publications
const pubs = read('publications.json').map((item) => {
  const btns = [
    button(item.pdf, 'PDF'),
    button(item.video, 'Video'),
    button(item.code, 'Code'),
  ].filter(Boolean).join(' ');
  const meta = [item.authors, item.venue].filter(Boolean).map(esc).join(' &middot; ');
  return row(esc(item.year || ''), item.url, esc(item.title), btns, meta);
}).join('\n');

// -------------------------------------------------- publications JSON-LD graph
// Each paper becomes a ScholarlyArticle node. Where Salua is an author the node
// points at the Person @id in the main graph, so the two blocks join into one
// graph: "this person wrote these works".
const PERSON_ID = 'https://saluahamaza.eu/#person';
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

const articleNodes = read('publications.json').map((item) => {
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

const ldBlock = '  <script type="application/ld+json">\n    ' + ldJson + '\n  </script>';

// -------------------------------------------------------------------- write
let html = fs.readFileSync(indexPath, 'utf8');
const before = html;

{
  const start = '<!-- publications-ld:start -->';
  const end = '<!-- publications-ld:end -->';
  const re = new RegExp(start + '[\\s\\S]*?' + end);
  if (!re.test(html)) {
    console.error('Could not find the ' + start + ' / ' + end + ' markers in index.html');
    process.exit(1);
  }
  html = html.replace(re, start + '\n' + ldBlock + '\n  ' + end);
}

for (const [name, items] of [['news', news], ['publications', pubs]]) {
  const start = '<!-- ' + name + ':start -->';
  const end = '<!-- ' + name + ':end -->';
  const re = new RegExp(start + '[\\s\\S]*?' + end);
  if (!re.test(html)) {
    console.error('Could not find the ' + start + ' / ' + end + ' markers in index.html');
    process.exit(1);
  }
  html = html.replace(re, start + '\n' + items + '\n              ' + end);
}

const changed = html !== before;
if (changed) fs.writeFileSync(indexPath, html);
console.log('Rendered ' + read('news.json').length + ' news items and '
  + read('publications.json').length + ' publications into index.html'
  + (changed ? '' : ' (no change)'));

// Keep the sitemap's lastmod honest: bump it whenever the rendered content changes.
if (changed) {
  const sitemapPath = path.join(root, 'sitemap.xml');
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const bumped = sitemap.replace(/<lastmod>[^<]*<\/lastmod>/, '<lastmod>' + today + '</lastmod>');
  if (bumped !== sitemap) {
    fs.writeFileSync(sitemapPath, bumped);
    console.log('Updated sitemap.xml lastmod to ' + today);
  }
}
