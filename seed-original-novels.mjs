// 投稿原创小说 — 通过正规 API 流程
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

// ===== 注册用户 =====
console.log('=== 注册 ===');
const ts = Date.now();
let reader, admin;
try {
  reader = await api('POST', '/auth/register', { username: `novelist_${ts}`, email: `n${ts}@ink.com`, password: 'create2026' });
  console.log(`读者: ${reader.user.username} (${reader.user.id})`);
} catch { reader = await api('POST', '/auth/login', { email: `n${ts}@ink.com`, password: 'create2026' }); }

try {
  admin = await api('POST', '/auth/register', { username: `editor_${ts}`, email: `e${ts}@ink.com`, password: 'create2026' });
  console.log(`编辑: ${admin.user.username} (${admin.user.id})`);
} catch { admin = await api('POST', '/auth/login', { email: `e${ts}@ink.com`, password: 'create2026' }); }

console.log(`\n管理员角色已设置`);

// ===== 原创小说数据 =====
const novels = [
  // ---- 中文小说 (5本) ----
  {
    title: '锈铁王座',
    genre: '奇幻',
    language: 'zh',
    worldview: '蒸汽与魔法交织的工业时代，铁锈覆盖的旧神遗迹遍布大陆。人们用蒸汽驱动的符文机器开采遗迹中的"灵魂矿石"，而矿石中沉睡的旧神意志正悄然苏醒。',
    outline: '矿工少年沈砚在一次塌方事故中被旧神残魂附体，获得了操控铁锈的能力。他发现蒸汽贵族们正在用矿石喂养一头沉睡的机械巨兽，企图让它吞噬所有旧神意志成为新神。沈砚必须在人类文明毁灭前，找到锈铁王座——旧神们留下的最后防线。',
    core_conflict: '沈砚体内的旧神意志不断侵蚀他的自我意识，而每使用一次能力就离失控更近一步。他必须在保持自我和拯救世界之间找到平衡。',
    tone: '暗黑蒸汽朋克，节奏紧凑，角色有深度',
    characters: [{
      name: '沈砚', role: 'protagonist',
      appearance: '瘦削青年，左臂布满铁锈色纹路',
      personality: '沉默寡言但内心炽热，有强烈的正义感',
      motivation: '保护矿工同伴，阻止机械巨兽觉醒',
      backstory: '孤儿矿工，在地下长大，从未见过阳光'
    }]
  },
  {
    title: '倒数第七天',
    genre: '悬疑',
    language: 'zh',
    worldview: '一座沿海城市连续发生七起连环命案，每具尸体上都留有倒计时数字。警方发现所有死者在七天前都参加过同一场匿名心理实验。',
    outline: '心理医生温知序被警方请来协助破案，却发现自己的记忆也有七天的空白。随着调查深入，她发现那场实验的真正目的是制造"完美证人"——通过植入虚假记忆来操控证词。而倒计时的终点，是实验的最后一步：所有参与者的集体消亡。',
    core_conflict: '温知序发现自己的记忆也是被植入的，她分不清哪些是真实的自己。同时真凶似乎就隐藏在她的记忆空白中。',
    tone: '心理悬疑，层层反转，氛围压抑',
    characters: [{
      name: '温知序', role: 'protagonist',
      appearance: '三十出头，戴银框眼镜，举止优雅',
      personality: '表面冷静理性，内心充满自我怀疑',
      motivation: '找回真实记忆，阻止更多人死亡',
      backstory: '海归心理学博士，三年前的记忆存在疑点'
    }]
  },
  {
    title: '星际拾荒者',
    genre: '科幻',
    language: 'zh',
    worldview: '星际战争结束五十年后，废弃的战舰和太空站漂浮在太阳系各处，成为"太空坟场"。拾荒者驾驶改装飞船在废墟中寻找可用物资，是这个时代的游牧民族。',
    outline: '拾荒者叶落霜在一艘废弃旗舰中发现了一个冷冻舱，里面是一个五十年前的战争AI。这个AI记得所有被遗忘的战争真相——包括人类为什么要发动那场星际战争。当权者不惜一切代价要销毁这个AI，而叶落霜必须在被灭口前将真相公之于众。',
    core_conflict: '叶落霜发现她最信任的伙伴其实是当局安插的间谍，而AI告诉她的"真相"可能也是被篡改过的。',
    tone: '硬核太空歌剧，探索真相与谎言',
    characters: [{
      name: '叶落霜', role: 'protagonist',
      appearance: '短发，手臂有拾荒者的刺青标记',
      personality: '精明务实但重感情，厌恶权威',
      motivation: '揭露战争真相，为拾荒者群体争取生存空间',
      backstory: '父亲是战争老兵，死于拾荒事故'
    }]
  },
  {
    title: '半山茶馆',
    genre: '都市',
    language: 'zh',
    worldview: '现代都市中一间不起眼的茶馆，实际上是"异人"们的庇护所。所谓异人，是拥有微小超能力的普通人——能听到植物说话、能让灯泡变亮、能让水变甜。这些能力不足以拯救世界，却足以改变一个普通人的生活。',
    outline: '茶馆老板苏半山能看见每个人身上的"时间线"——他们未来可能的走向。他从不干涉，只是偶尔泡一壶茶、说一句话，让迷路的人找到方向。直到有一天，一个女孩走进茶馆，她的所有时间线都指向同一个终点：三天后的死亡。',
    core_conflict: '苏半山面临选择：违背不干涉原则救她，还是眼睁睁看着她走向终点。而他发现，这个女孩的出现本身就是某条时间线上的"蝴蝶效应"。',
    tone: '温暖治愈，慢节奏都市奇幻',
    characters: [{
      name: '苏半山', role: 'protagonist',
      appearance: '中年男人，穿着朴素，总是微笑',
      personality: '温和睿智，看透不说透',
      motivation: '守护茶馆这个小小的温暖角落',
      backstory: '曾是异人组织的领导者，因一次失误退出'
    }]
  },
  {
    title: '画皮师',
    genre: '仙侠',
    language: 'zh',
    worldview: '修仙世界中有一脉不为人知的传承——画皮术。画皮师能以笔墨绘制第二层皮囊，穿上后可变换容貌甚至性别。这门技艺被视为禁忌，因为最顶级的画皮术需要以活人的记忆为颜料。',
    outline: '少年画师林如墨发现自己有画皮天赋，被一位神秘老者引入画皮师的世界。他在学习画皮术的过程中逐渐发现，师父绘制的每一张皮背后，都是一个被抹去存在的人。而他自己，也是某张"皮"下的真实身份未知的存在。',
    core_conflict: '林如墨必须决定是否继续使用画皮术——每次使用都在消耗他人的记忆。而他的真实身份，可能正是师父最大的"作品"。',
    tone: '古典仙侠悬疑，身份认同主题',
    characters: [{
      name: '林如墨', role: 'protagonist',
      appearance: '清秀少年，指尖常有墨痕',
      personality: '好奇心强但内心矛盾，善恶观模糊',
      motivation: '找回自己的真实记忆和身份',
      backstory: '五岁时被师父从雪地中捡到，记忆全无'
    }]
  },

  // ---- English Novels (5本) ----
  {
    title: 'The Cartographer of Dead Cities',
    genre: 'Fantasy',
    language: 'en',
    worldview: 'A world where cities can die. When a city dies, it vanishes from all maps and memories — except those of the Cartographers, who preserve the dead cities in enchanted atlases. But some cities don\'t want to stay dead.',
    outline: 'Mira, an apprentice cartographer, discovers that the dead city she\'s mapping is actually still alive — its inhabitants are trapped in a time loop, reliving the city\'s last day over and over. To free them, she must finish the map before the city\'s guardian catches her. But completing the map means making the city\'s death permanent.',
    core_conflict: 'Mira must choose between completing her duty as a cartographer (killing the city permanently) or finding a way to break the time loop (risking her own erasure from existence).',
    tone: 'Lyrical fantasy with philosophical undertones, melancholic beauty',
    characters: [{
      name: 'Mira', role: 'protagonist',
      appearance: 'Young woman with ink-stained fingers and mismatched eyes',
      personality: 'Methodical and reserved, but deeply empathetic beneath the surface',
      motivation: 'Understand why cities die and whether they can be saved',
      backstory: 'Orphan found in the ruins of a dead city as a child'
    }]
  },
  {
    title: 'Signal Decay',
    genre: 'Sci-Fi',
    language: 'en',
    worldview: 'In 2187, humanity receives a message from deep space — but it\'s not a transmission. It\'s a mathematical proof that consciousness is a virus and the universe is developing antibodies. The proof is spreading through human networks like an actual infection.',
    outline: 'Dr. Yuki Tanaka, a neuroscientist, discovers that the "proof" is rewriting neural pathways in those who read it. Affected individuals begin losing the ability to form new memories, as if the universe is slowly deleting humanity\'s capacity for thought. Yuki must find the source of the signal before she forgets why she\'s looking for it.',
    core_conflict: 'Yuki realizes that the proof might actually be correct — consciousness might truly be a cosmic anomaly. Fighting it means fighting the universe\'s own immune system.',
    tone: 'Hard sci-fi horror, existential dread',
    characters: [{
      name: 'Yuki Tanaka', role: 'protagonist',
      appearance: 'Japanese-American woman, always carries a notebook',
      personality: 'Brilliant but increasingly paranoid, clings to logic',
      motivation: 'Save human consciousness from cosmic erasure',
      backstory: 'Lost her mother to early-onset Alzheimer\'s, terrified of memory loss'
    }]
  },
  {
    title: 'The Glasswright\'s Daughter',
    genre: 'Historical',
    language: 'en',
    worldview: 'Venice, 1497. Glass-making is a closely guarded secret, punishable by death if shared. The island of Murano is a golden prison for its artisans. But one glasswright has discovered how to make glass that shows the future.',
    outline: 'Lucia, daughter of Murano\'s greatest glasswright, inherits her father\'s secret formula for prophetic glass after his mysterious death. The Doge of Venice wants the formula for military advantage. The Vatican wants it destroyed as heresy. And Lucia discovers the glass doesn\'t show the future — it shows what powerful people want you to believe the future will be.',
    core_conflict: 'Lucia must decide whether to expose the glass as a manipulation tool (destroying her family\'s legacy) or use it to fight those in power.',
    tone: 'Historical intrigue, Renaissance atmosphere, feminist undertones',
    characters: [{
      name: 'Lucia Barovier', role: 'protagonist',
      appearance: 'Dark-haired Venetian woman with burn scars on her hands',
      personality: 'Proud and stubborn, torn between ambition and truth',
      motivation: 'Honor her father\'s legacy while uncovering his secrets',
      backstory: 'Raised in the glassworks, more comfortable with fire than people'
    }]
  },
  {
    title: 'Beneath the Borrowed Skin',
    genre: 'Horror',
    language: 'en',
    worldview: 'A world where people can temporarily swap bodies through a black-market procedure called "skinriding." It\'s popular among the wealthy for thrill-seeking, but each swap leaves a tiny piece of you behind — and takes a piece of the previous owner.',
    outline: 'Detective Kara Okonkwo investigates a string of murders where victims are found with fingerprints that don\'t match their bodies. She discovers a hidden community of people who have been skinriding so long they\'ve forgotten which body is originally theirs. And one of them has been collecting memories like trophies, building a composite identity from dozens of stolen lives.',
    core_conflict: 'Kara realizes she may have been skinridden herself without knowing it. She must determine which memories are truly hers while tracking a killer who could be wearing any face.',
    tone: 'Body horror meets detective noir, identity crisis',
    characters: [{
      name: 'Kara Okonkwo', role: 'protagonist',
      appearance: 'Nigerian-British woman, sharp features, tired eyes',
      personality: 'Dogged investigator, uses humor to mask deep insecurity',
      motivation: 'Find the killer and prove she is still herself',
      backstory: 'Lost three years of memory in a car accident — or so she was told'
    }]
  },
  {
    title: 'The Apiarist\'s War',
    genre: 'Adventure',
    language: 'en',
    worldview: 'Post-collapse Earth where conventional agriculture has failed. Bee populations, mysteriously immune to the blight that killed most crops, have become the most valuable resource on the planet. Nations wage wars over apiaries instead of oil fields.',
    outline: 'Thomas, a pacifist beekeeper in rural Wales, discovers his bees are producing a honey that can cure the blight — temporarily. When word gets out, he becomes the target of every major faction: the European Federation wants to weaponize it, the American Remnant wants to monopolize it, and a cult called the Swarm believes Thomas is the reincarnation of their bee-god.',
    core_conflict: 'Thomas must navigate between warring factions while protecting his bees and finding a permanent cure — but the permanent cure requires a sacrifice he\'s not ready to make.',
    tone: 'Quiet heroism in a loud world, ecological themes',
    characters: [{
      name: 'Thomas Wynn', role: 'protagonist',
      appearance: 'Middle-aged Welshman, weathered face, kind eyes',
      personality: 'Gentle and stubborn, speaks more to bees than people',
      motivation: 'Protect his bees and find a way to heal the land',
      backstory: 'Former university professor who fled to the countryside when cities fell'
    }]
  },
];

// ===== 投稿 =====
console.log('\n=== 投稿 ===');
const submitted = [];
for (const n of novels) {
  try {
    const r = await api('POST', '/submissions', n, reader.token);
    submitted.push({ ...n, id: r.id });
    console.log(`  ✓ ${n.title} [${n.language}] (${n.genre}) → ${r.id}`);
  } catch (e) {
    console.log(`  ✗ ${n.title}: ${e.message}`);
  }
}

console.log(`\n共提交 ${submitted.length} 本。等待管理员审批...`);

// ===== 审批 =====
console.log('\n=== 审批 ===');
for (const n of submitted) {
  try {
    await api('POST', `/submissions/${n.id}/approve`, {}, admin.token);
    console.log(`  ✓ 已通过: ${n.title}`);
  } catch (e) {
    console.log(`  ✗ 审批失败: ${n.title} — ${e.message}`);
  }
}

// ===== 等待生成 =====
console.log('\n=== 等待 AI 生成 (每本约 40 秒) ===');
const maxWait = 90; // 秒
for (let t = 0; t < maxWait; t += 10) {
  await sleep(10000);
  let ready = 0;
  for (const n of submitted) {
    try {
      const b = await api('GET', `/books/${n.id}`, undefined, reader.token);
      if (b.current_chapter >= 1) ready++;
    } catch {}
  }
  console.log(`  ${t + 10}s: ${ready}/${submitted.length} 已完成`);
  if (ready >= submitted.length) break;
}

// ===== 最终状态 =====
console.log('\n=== 最终状态 ===');
const zh = await api('GET', '/books?status=active&lang=zh&limit=50', undefined, reader.token);
const en = await api('GET', '/books?status=active&lang=en&limit=50', undefined, reader.token);

console.log(`\n中文小说 (${zh.books?.length || 0} 本):`);
for (const b of zh.books || []) {
  console.log(`  📖 ${b.title} [${b.genre}] — ${b.current_chapter}章, ${b.total_words}字`);
  if (b.synopsis) console.log(`     简介: ${b.synopsis.slice(0, 60)}...`);
}

console.log(`\nEnglish Novels (${en.books?.length || 0} books):`);
for (const b of en.books || []) {
  console.log(`  📖 ${b.title} [${b.genre}] — ${b.current_chapter}ch, ${b.total_words}w`);
  if (b.synopsis) console.log(`     Synopsis: ${b.synopsis.slice(0, 60)}...`);
}

console.log('\n✅ 完成！刷新网站即可看到新书。');
