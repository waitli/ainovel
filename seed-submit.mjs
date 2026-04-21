import { ProxyAgent } from 'undici';
const agent = new ProxyAgent('http://172.20.224.1:8080');
const API = 'https://api.ainovel.waitli.top/api/v1';

const h = (t) => ({ 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) });
async function api(method, path, body, t) {
  const r = await fetch(`${API}${path}`, { method, headers: h(t), body: body && JSON.stringify(body), dispatcher: agent });
  const d = await r.json();
  if (!d.success) throw new Error(`${path}: ${d.error}`);
  return d.data;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const reader = await api('POST', '/auth/login', { email: 'n1776325916530@ink.com', password: 'create2026' });
const admin = await api('POST', '/auth/login', { email: 'e1776325916530@ink.com', password: 'create2026' });
console.log(`登录: ${reader.user.username} / ${admin.user.username}`);

const novels = [
  { title: '锈铁王座', genre: '奇幻', language: 'zh', worldview: '蒸汽与魔法交织的工业时代，铁锈覆盖的旧神遗迹遍布大陆。人们用蒸汽驱动的符文机器开采遗迹中的灵魂矿石，矿石中沉睡的旧神意志正悄然苏醒。', outline: '矿工少年沈砚在塌方中被旧神残魂附体，获得操控铁锈的能力。他发现蒸汽贵族用矿石喂养一头机械巨兽，企图让它成为新神。沈砚必须找到锈铁王座——旧神最后的防线。', core_conflict: '沈砚体内的旧神意志不断侵蚀他的自我意识，每使用能力就离失控更近。', tone: '暗黑蒸汽朋克，节奏紧凑', characters: [{ name: '沈砚', role: 'protagonist', appearance: '瘦削青年，左臂布满铁锈色纹路', personality: '沉默寡言内心炽热', motivation: '保护同伴，阻止机械巨兽觉醒', backstory: '孤儿矿工，从未见过阳光' }] },
  { title: '倒数第七天', genre: '悬疑', language: 'zh', worldview: '沿海城市连续七起连环命案，尸体留有倒计时数字。所有死者七天前参加过同一场匿名心理实验。', outline: '心理医生温知序被请来协助破案，发现自己的记忆也有七天空白。那场实验的目的是制造完美证人——通过植入虚假记忆操控证词。倒计时终点是所有参与者集体消亡。', core_conflict: '温知序发现自己的记忆也是被植入的，分不清哪些是真实的自己。', tone: '心理悬疑，层层反转', characters: [{ name: '温知序', role: 'protagonist', appearance: '三十出头，戴银框眼镜', personality: '表面冷静理性，内心自我怀疑', motivation: '找回真实记忆，阻止更多人死', backstory: '海归心理学博士，三年前记忆存疑' }] },
  { title: '星际拾荒者', genre: '科幻', language: 'zh', worldview: '星际战争结束五十年，废弃战舰漂浮太阳系。拾荒者驾驶改装飞船在废墟中寻找物资，是这个时代的游牧民族。', outline: '拾荒者叶落霜在废弃旗舰中发现冷冻舱，里面是五十年前的战争AI。它记得所有被遗忘的战争真相。当权者要销毁AI，叶落霜必须在被灭口前将真相公之于众。', core_conflict: '最信任的伙伴是当局间谍，AI的真相也可能是篡改过的。', tone: '硬核太空歌剧', characters: [{ name: '叶落霜', role: 'protagonist', appearance: '短发，手臂有拾荒者刺青', personality: '精明务实重感情', motivation: '揭露战争真相', backstory: '父亲是战争老兵，死于拾荒事故' }] },
  { title: '半山茶馆', genre: '都市', language: 'zh', worldview: '现代都市中一间茶馆是异人庇护所。异人拥有微小超能力——听植物说话、让灯泡变亮、让水变甜。', outline: '茶馆老板苏半山能看见每个人的时间线。他从不干涉，只是偶尔泡茶说句话。直到一个女孩走进茶馆，她所有时间线都指向三天后的死亡。', core_conflict: '苏半山面临选择：违背不干涉原则救她，还是眼睁睁看她走向终点。', tone: '温暖治愈，慢节奏都市奇幻', characters: [{ name: '苏半山', role: 'protagonist', appearance: '中年男人，穿着朴素', personality: '温和睿智，看透不说透', motivation: '守护茶馆这个温暖角落', backstory: '曾是异人组织领导，因失误退出' }] },
  { title: '画皮师', genre: '仙侠', language: 'zh', worldview: '修仙世界有禁忌传承——画皮术。画皮师以笔墨绘制皮囊，穿上可变换容貌。顶级画皮术需以活人记忆为颜料。', outline: '少年画师林如墨发现自己有画皮天赋。他在学习中发现师父每张皮背后都是被抹去存在的人。而他自己也是某张皮下真实身份未知的存在。', core_conflict: '每次使用画皮术都在消耗他人记忆。他的真实身份可能是师父最大的作品。', tone: '古典仙侠悬疑', characters: [{ name: '林如墨', role: 'protagonist', appearance: '清秀少年，指尖常有墨痕', personality: '好奇心强但善恶观模糊', motivation: '找回真实记忆和身份', backstory: '五岁被师父从雪地中捡到，记忆全无' }] },
  { title: 'The Cartographer of Dead Cities', genre: 'Fantasy', language: 'en', worldview: 'A world where cities can die. When a city dies it vanishes from all maps and memories — except those of the Cartographers who preserve dead cities in enchanted atlases.', outline: 'Mira discovers the dead city she is mapping is actually alive — inhabitants trapped in a time loop reliving the last day forever. Completing the map makes death permanent. Breaking the loop risks her own erasure.', core_conflict: 'Mira must choose between her duty as a cartographer and saving the city.', tone: 'Lyrical fantasy, melancholic beauty', characters: [{ name: 'Mira', role: 'protagonist', appearance: 'Ink-stained fingers, mismatched eyes', personality: 'Methodical but deeply empathetic', motivation: 'Understand why cities die', backstory: 'Orphan found in ruins of a dead city' }] },
  { title: 'Signal Decay', genre: 'Sci-Fi', language: 'en', worldview: 'In 2187 humanity receives a mathematical proof from deep space that consciousness is a virus and the universe is developing antibodies. The proof spreads through networks like an infection.', outline: 'Neuroscientist Yuki Tanaka discovers the proof rewrites neural pathways. Affected individuals lose the ability to form new memories. She must find the source before she forgets why she is looking.', core_conflict: 'The proof might actually be correct — consciousness might be a cosmic anomaly.', tone: 'Hard sci-fi horror, existential dread', characters: [{ name: 'Yuki Tanaka', role: 'protagonist', appearance: 'Japanese-American, always carries a notebook', personality: 'Brilliant but paranoid', motivation: 'Save human consciousness', backstory: 'Lost mother to Alzheimer\'s, terrified of memory loss' }] },
  { title: 'The Glasswright\'s Daughter', genre: 'Historical', language: 'en', worldview: 'Venice 1497. Glass-making secrets punishable by death. Murano is a golden prison. One glasswright has discovered glass that shows the future.', outline: 'Lucia inherits her father\'s formula for prophetic glass after his mysterious death. The Doge wants it for war. The Vatican calls it heresy. But the glass does not show the future — it shows what powerful people want you to believe.', core_conflict: 'Expose the glass as manipulation or use it to fight those in power.', tone: 'Historical intrigue, Renaissance atmosphere', characters: [{ name: 'Lucia Barovier', role: 'protagonist', appearance: 'Dark-haired Venetian, burn scars on hands', personality: 'Proud, torn between ambition and truth', motivation: 'Honor father\'s legacy while uncovering secrets', backstory: 'Raised in glassworks, more comfortable with fire than people' }] },
  { title: 'Beneath the Borrowed Skin', genre: 'Horror', language: 'en', worldview: 'A world where people can swap bodies through black-market skinriding. Each swap leaves a piece of you behind and takes a piece of the previous owner.', outline: 'Detective Kara investigates murders where victims have fingerprints that do not match their bodies. She finds a community who have skinridden so long they forgot which body is theirs. One collector builds identity from dozens of stolen lives.', core_conflict: 'Kara may have been skinridden herself. She must determine which memories are truly hers.', tone: 'Body horror meets detective noir', characters: [{ name: 'Kara Okonkwo', role: 'protagonist', appearance: 'Nigerian-British, sharp features, tired eyes', personality: 'Dogged, uses humor to mask insecurity', motivation: 'Find the killer, prove she is still herself', backstory: 'Lost three years of memory — or so she was told' }] },
  { title: 'The Apiarist\'s War', genre: 'Adventure', language: 'en', worldview: 'Post-collapse Earth. Conventional agriculture failed. Bees immune to the blight became the most valuable resource. Nations wage wars over apiaries.', outline: 'Pacifist beekeeper Thomas discovers his bees produce honey that temporarily cures the blight. European Federation wants to weaponize it. American Remnant wants to monopolize it. A cult called the Swarm believes Thomas is their bee-god reincarnated.', core_conflict: 'The permanent cure requires a sacrifice Thomas is not ready to make.', tone: 'Quiet heroism, ecological themes', characters: [{ name: 'Thomas Wynn', role: 'protagonist', appearance: 'Middle-aged Welshman, weathered face', personality: 'Gentle and stubborn', motivation: 'Protect bees, heal the land', backstory: 'Former professor who fled to countryside when cities fell' }] },
];

console.log(`\n=== 投稿 ${novels.length} 本 ===`);
const submitted = [];
for (const n of novels) {
  const r = await api('POST', '/submissions', n, reader.token);
  submitted.push({ ...n, id: r.id });
  console.log(`  ✓ ${n.title} [${n.language}]`);
}

console.log(`\n=== 审批 ===`);
for (const n of submitted) {
  await api('POST', `/submissions/${n.id}/approve`, {}, admin.token);
  console.log(`  ✓ ${n.title}`);
}

console.log(`\n=== 等待 AI 生成 ===`);
for (let t = 0; t < 120; t += 10) {
  await sleep(10000);
  let ready = 0, zhReady = 0, enReady = 0;
  for (const n of submitted) {
    try {
      const b = await api('GET', `/books/${n.id}`, undefined, reader.token);
      if (b.current_chapter >= 1) { ready++; if (n.language === 'zh') zhReady++; else enReady++; }
    } catch {}
  }
  console.log(`  ${t + 10}s: ${ready}/${submitted.length} (中文${zhReady}/5 英文${enReady}/5)`);
  if (ready >= submitted.length) break;
}

console.log(`\n=== 结果 ===`);
const zhBooks = await api('GET', '/books?status=active&lang=zh&limit=50', undefined, reader.token);
const enBooks = await api('GET', '/books?status=active&lang=en&limit=50', undefined, reader.token);
console.log(`\n中文 (${zhBooks.books?.length}):`);
for (const b of zhBooks.books || []) console.log(`  ${b.title} — ${b.current_chapter}章`);
console.log(`\nEnglish (${enBooks.books?.length}):`);
for (const b of enBooks.books || []) console.log(`  ${b.title} — ${b.current_chapter}ch`);
console.log('\n✅ 完成');
