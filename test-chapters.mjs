import { ProxyAgent } from 'undici';
const agent = new ProxyAgent('http://172.20.224.1:8080');
const API = 'https://api.ainovel.waitli.top/api/v1';

// Get first Chinese book
const res = await fetch(`${API}/books?status=active&lang=zh&limit=1`, { dispatcher: agent });
const data = await res.json();
const book = data.data.books[0];
console.log(`Book: ${book.title} (${book.id})`);
console.log(`Chapters: ${book.current_chapter}`);

// Get chapter list
const chRes = await fetch(`${API}/books/${book.id}/chapters`, { dispatcher: agent });
const chData = await chRes.json();
console.log(`\nChapter list: ${chData.data.chapters.length} chapters`);
for (const ch of chData.data.chapters.slice(0, 3)) {
  console.log(`  ${ch.title} (${ch.word_count} words)`);
}

// Read chapter 1
const readRes = await fetch(`${API}/books/${book.id}/chapters/1`, { dispatcher: agent });
const readData = await readRes.json();
console.log(`\nChapter 1 content preview:`);
console.log(readData.data.content?.slice(0, 200));

// Get first English book
const enRes = await fetch(`${API}/books?status=active&lang=en&limit=1`, { dispatcher: agent });
const enData = await enRes.json();
const enBook = enData.data.books[0];
console.log(`\nEnglish Book: ${enBook.title} (${enBook.id})`);

const enChRes = await fetch(`${API}/books/${enBook.id}/chapters`, { dispatcher: agent });
const enChData = await enChRes.json();
console.log(`Chapters: ${enChData.data.chapters.length}`);
for (const ch of enChData.data.chapters.slice(0, 3)) {
  console.log(`  ${ch.title}`);
}

const enReadRes = await fetch(`${API}/books/${enBook.id}/chapters/1`, { dispatcher: agent });
const enReadData = await enReadRes.json();
console.log(`\nEN Chapter 1 content preview:`);
console.log(enReadData.data.content?.slice(0, 200));
