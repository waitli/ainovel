import { ProxyAgent } from 'undici';
const agent = new ProxyAgent('http://172.20.224.1:8080');
const API = 'https://api.ainovel.waitli.top/api/v1';

// Get first Chinese book with R2 content (seed books have deterministic IDs)
import crypto from 'crypto';
function makeId(seed) {
  return crypto.createHash('md5').update(`test-${seed}`).digest('hex');
}

// First 5 zh books: zh-0 to zh-4
for (let i = 0; i < 5; i++) {
  const bookId = makeId(`zh-${String(i).padStart(3, '0')}`);
  try {
    const res = await fetch(`${API}/books/${bookId}`, { dispatcher: agent });
    const data = await res.json();
    if (!data.success) continue;
    const book = data.data;
    
    const chRes = await fetch(`${API}/books/${bookId}/chapters/1`, { dispatcher: agent });
    const chData = await chRes.json();
    if (chData.data?.content) {
      console.log(`\n=== ${book.title} ===`);
      console.log(`Chapter 1 content (${chData.data.content.length} chars):`);
      console.log(chData.data.content.slice(0, 150));
      console.log('...');
    } else {
      console.log(`${book.title}: no content`);
    }
  } catch(e) {
    console.log(`Book ${i}: error - ${e.message}`);
  }
}

// First 5 en books: en-0 to en-4
for (let i = 0; i < 5; i++) {
  const bookId = makeId(`en-${String(i).padStart(3, '0')}`);
  try {
    const res = await fetch(`${API}/books/${bookId}`, { dispatcher: agent });
    const data = await res.json();
    if (!data.success) continue;
    const book = data.data;
    
    const chRes = await fetch(`${API}/books/${bookId}/chapters/1`, { dispatcher: agent });
    const chData = await chRes.json();
    if (chData.data?.content) {
      console.log(`\n=== ${book.title} ===`);
      console.log(`Chapter 1 content (${chData.data.content.length} chars):`);
      console.log(chData.data.content.slice(0, 150));
      console.log('...');
    } else {
      console.log(`${book.title}: no content`);
    }
  } catch(e) {
    console.log(`EN Book ${i}: error - ${e.message}`);
  }
}
