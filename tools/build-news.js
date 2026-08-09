/*
 * Renders data/news.json into index.html between the news:start / news:end
 * markers, so the news items are present in the served HTML for crawlers that
 * do not run JavaScript (Bing, LinkedIn/X preview bots, AI crawlers).
 *
 * The page still re-renders the list from data/news.json at runtime, so edits
 * to the JSON show up for visitors immediately. Run this before committing to
 * keep the static copy in sync:
 *
 *   node tools/build-news.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const news = JSON.parse(fs.readFileSync(path.join(root, 'data', 'news.json'), 'utf8'));

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const button = (url, label) => url
  ? '<a href="' + esc(url) + '" class="button small" target="_blank" rel="noopener noreferrer">' + label + '</a>'
  : '';

const items = news.map(function (item) {
  const btns = [
    button(item.article, 'Article'),
    button(item.video, 'Video'),
    button(item.linkedin, 'LinkedIn'),
  ].filter(Boolean).join(' ');
  return [
    '              <li>',
    '                <a href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer"><p>' + esc(item.title) + '</p></a>',
    btns ? '                <div class="news-buttons">' + btns + '</div>' : '',
    '              </li>',
  ].filter(Boolean).join('\n');
}).join('\n');

const html = fs.readFileSync(indexPath, 'utf8');
const start = '<!-- news:start -->';
const end = '<!-- news:end -->';
const re = new RegExp(start + '[\\s\\S]*?' + end);

if (!re.test(html)) {
  console.error('Could not find the ' + start + ' / ' + end + ' markers in index.html');
  process.exit(1);
}

const updated = html.replace(re, start + '\n' + items + '\n              ' + end);
fs.writeFileSync(indexPath, updated);
console.log('Rendered ' + news.length + ' news items into index.html');
