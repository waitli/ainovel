import { ProxyAgent } from 'undici';
const agent = new ProxyAgent('http://172.20.224.1:8080');
const API = 'https://api.ainovel.waitli.top/api/v1';

// Read chapter 1 of each book
const books = [
  { id: 'fd51bff5-f54b-4504-9a75-ec6094a73847', name: '万古武帝归来' },
  { id: '8ee9dcab-7415-475a-bb59-11c3eb2fd5af', name: 'The Last Sorcerer' },
];

for (const b of books) {
  const res = await fetch(`${API}/books/${b.id}/chapters/1`, { dispatcher: agent });
  const d = await res.json();
  const content = d.data?.content || 'NO CONTENT';
  console.log(`\n=== ${b.name} ===`);
  console.log(`Title: ${d.data?.chapter?.title}`);
  console.log(`Words: ${d.data?.chapter?.word_count}`);
  console.log(`Preview: ${content.slice(0, 150)}...`);
  console.log(`Directions: ${d.data?.directions?.length || 0}`);
}
