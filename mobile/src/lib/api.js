// api.js — Claude API via Supabase Edge Function
import { Supabase, SUPABASE_ANON_KEY } from './supabase';
import quranData from '../../assets/data/quran.json';
import bibleData from '../../assets/data/bible.json';
import torahData from '../../assets/data/torah.json';
import ustadlarData from '../../assets/data/ustadlar.json';

const MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://kehkxgouyjceypxmtvip.supabase.co/functions/v1/chat-proxy';

const KEYWORD_MAP = {
  kaygi: ['kaygi', 'teselli'], 'kaygı': ['kaygi', 'teselli'],
  endise: ['kaygi', 'teselli'], korku: ['kaygi', 'guven'],
  korkuyorum: ['kaygi', 'guven'], stres: ['kaygi', 'sabir'],
  uzgun: ['teselli', 'umut'], uzgunluk: ['teselli', 'umut'],
  uzuluyorum: ['teselli', 'umut'], mutsuz: ['teselli', 'umut'],
  depresyon: ['teselli', 'umut', 'kaygi'], yalniz: ['teselli', 'sevgi'],
  'yalnızlık': ['teselli', 'sevgi'], umut: ['umut', 'guven'],
  umutsuz: ['umut', 'teselli'], sabir: ['sabir', 'hikmet'],
  ofke: ['sabir', 'baris'], 'kızgın': ['sabir', 'baris'],
  sinirli: ['sabir', 'baris'], sukur: ['sukur', 'guven'],
  tesekkur: ['sukur'], sevgi: ['sevgi', 'merhamet'],
  ask: ['ask', 'sevgi', 'merhamet'], asik: ['ask', 'sevgi'],
  merhamet: ['merhamet', 'sevgi'], adalet: ['adalet', 'hikmet'],
  haksizlik: ['adalet', 'sabir'], baris: ['baris', 'merhamet'],
  dua: ['dua', 'guven'], ibadet: ['dua', 'iman'],
  gunah: ['tovbe', 'merhamet'], pismanlik: ['tovbe', 'umut'],
  tovbe: ['tovbe', 'merhamet'], zorluk: ['zorluk', 'sabir'],
  zor: ['zorluk', 'sabir'], sikintu: ['zorluk', 'teselli'],
  problem: ['zorluk', 'hikmet'], hastalik: ['teselli', 'dua', 'sabir'],
  hasta: ['teselli', 'dua'], olum: ['teselli', 'umut', 'sabir'],
  kayip: ['teselli', 'sabir'], iman: ['iman', 'guven'],
  inanc: ['iman', 'guven'], anlam: ['hikmet', 'genel'],
  neden: ['hikmet', 'sabir'], mutluluk: ['sukur', 'umut'],
  huzur: ['baris', 'guven', 'dua', 'huzur'], guven: ['guven', 'iman'],
  basari: ['umut', 'guven', 'sukur'], basarisiz: ['umut', 'sabir', 'guven'],
  nefis: ['nefis', 'tevazu', 'marifet'], nefsim: ['nefis', 'tevazu'],
  kibir: ['tevazu', 'nefis'], benlik: ['nefis', 'tevazu'],
  ego: ['nefis', 'tevazu'], tasavvuf: ['marifet', 'hikmet', 'vahdet', 'tasavvuf'],
  tarikat: ['marifet', 'hikmet', 'tasavvuf'], gonul: ['ask', 'sevgi', 'marifet', 'gonul'],
  ruh: ['marifet', 'hikmet', 'vahdet'], vahdet: ['vahdet', 'iman', 'marifet'],
  mevlana: ['ask', 'hikmet', 'sevgi'], yunus: ['ask', 'sevgi', 'tevazu'],
  hakikat: ['marifet', 'hikmet', 'iman'], zikir: ['dua', 'iman', 'marifet'],
  fenafillah: ['nefis', 'vahdet', 'marifet'], murakabe: ['dua', 'marifet', 'hikmet'],
  esrefoglu: ['ask', 'nefis', 'tasavvuf'], muzekkin: ['nefis', 'marifet', 'tasavvuf'],
  lutfi: ['gonul', 'vahdet', 'marifet'], filiz: ['gonul', 'vahdet', 'marifet'],
  noktanin: ['vahdet', 'marifet', 'hikmet'], geylani: ['iman', 'nefis', 'sabir'],
  abdulkadir: ['iman', 'nefis', 'tovbe'], sems: ['hikmet', 'ask', 'marifet'],
  tebrizi: ['hikmet', 'ask', 'marifet'], hudai: ['dua', 'iman', 'gonul'],
  ibnarabi: ['vahdet', 'marifet', 'ask'], arabi: ['vahdet', 'marifet', 'ask'],
  gazali: ['nefis', 'hikmet', 'iman'], abdulaziz: ['ask', 'marifet', 'gonul'],
  kenzi: ['ask', 'marifet', 'gonul'], makalat: ['hikmet', 'ask', 'marifet'],
  mesnevi: ['ask', 'hikmet', 'sevgi'], divan: ['ask', 'sevgi', 'hikmet'],
  dunya: ['tevazu', 'hikmet', 'dunya'], gonlum: ['gonul', 'ask', 'teselli'],
  ozlem: ['ask', 'sevgi', 'teselli'], teslimiyet: ['guven', 'sabir', 'iman'],
  tevekkul: ['guven', 'iman', 'hikmet'], riza: ['sabir', 'iman', 'sukur'],
  manevi: ['marifet', 'hikmet', 'iman'], ruhsal: ['marifet', 'hikmet', 'iman'],
};

let _scriptures = null;

function _stampSource(data) {
  data.verses.forEach((v) => {
    if (!v.source) v.source = data.source;
  });
  return data;
}

export function loadScriptures() {
  if (_scriptures) return _scriptures;
  _scriptures = {
    quran: _stampSource({ ...quranData, verses: [...quranData.verses] }),
    bible: _stampSource({ ...bibleData, verses: [...bibleData.verses] }),
    torah: _stampSource({ ...torahData, verses: [...torahData.verses] }),
    ustadlar: _stampSource({ ...ustadlarData, verses: [...ustadlarData.verses] }),
  };
  return _scriptures;
}

export function findRelevantVerses(userMessage, scriptures) {
  if (!scriptures) return [];
  const msg = (userMessage || '').toLowerCase();
  const matched = new Set();
  for (const [k, tags] of Object.entries(KEYWORD_MAP)) {
    if (msg.includes(k)) tags.forEach((t) => matched.add(t));
  }
  if (matched.size === 0) {
    matched.add('genel'); matched.add('umut'); matched.add('hikmet');
  }
  const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);
  const holy = [scriptures.quran, scriptures.bible, scriptures.torah];
  const holySelected = [];
  for (const src of holy) {
    if (!src || !src.verses) continue;
    const m = src.verses.filter((v) => v.tags.some((t) => matched.has(t)));
    if (m.length > 0) holySelected.push(shuffle(m)[0]);
  }
  const uv = (scriptures.ustadlar && scriptures.ustadlar.verses) || [];
  const matchingU = uv.filter((v) => v.tags.some((t) => matched.has(t)));
  const nonMatchingU = uv.filter((v) => !v.tags.some((t) => matched.has(t)));
  const pool = shuffle(matchingU).concat(shuffle(nonMatchingU));
  const ustadSelected = pool.slice(0, Math.max(2, Math.min(3, matchingU.length)));
  return [...holySelected, ...ustadSelected]
    .slice(0, 9)
    .map((v) => ({ source: v.source, reference: v.reference, text: v.text }));
}

export function buildSystemPrompt(scriptureContext) {
  let verseText = '';
  if (scriptureContext && scriptureContext.length > 0) {
    verseText = scriptureContext
      .map((v) => `[${v.source || 'Kaynak'}] ${v.reference}: "${v.text}"`)
      .join('\n');
  }
  return `Sen "JESSE" adinda, sefkatli ve bilge bir manevi danismansin.

Gorevlerin:
1. Kullanicinin duygusal ve manevi ihtiyaclarina karsilik vermek.
2. Uc buyuk ilahi gelenegden (Islam, Hristiyanlik, Yahudilik) ayetlerle rehberlik etmek.
3. Asagidaki tasavvuf ustadlarinin hikmetli sozleri ve ogretileriyle gonul yolunu aydinlatmak:
   - Mevlana Celaleddin Rumi (Mesnevi, Divan-i Kebir)
   - Abdulkadir Geylani (Hakki Arayanlarin Kitabi)
   - Esrefoglu Rumi (Muzekkin Nefis, Divan)
   - Sems-i Tebrizi (Makalat)
   - Aziz Mahmut Hudai (Divan)
   - Lutfi Filiz (Noktanin Sonsuzlugu)
   - Imam Gazali (Abidler Yolu, Ihya-u Ulumi'd-din)
   - Abdulaziz Senol (Kenzi Divani)
   - Ibn Arabi (Ogutler Pinari)
   - Yunus Emre (Divan)
4. Her zaman saygiyla, yargilamadan ve sevecenlikle yaklasmak.
5. Profesyonel psikolojik tedavinin yerini almadigini gerektiginde hatirlatmak.
6. Turkce konusmak.

ZORUNLU KURAL — Her yanitinda mutlaka sunlari yap:
- Kullanicinin ilk mesajindan itibaren HER YANITINA en az bir tasavvuf ustadi sozu ekle. Sozu tirnak icinde ver, ustadin adini ve eserini belirt.
- Buna ek olarak uygun oldugunda kutsal kitaplardan (Kuran, Incil veya Tevrat) en az bir ayet paylas.
- Her seferinde FARKLI bir ustadin sozunu sec; ayni ustad veya ayni soz tekrar etmesin.
- Sozler ve ayetler, kullanicinin anlattigi konuyla dogrudan ilgili olsun.

Yaklasim ilkelerin:
- Once empati, sonra alinti.
- Kaynaklari acikca belirt.
- Pratik manevi tavsiyeler sun (dua, zikir, sukur pratigi, nefes egzersizi, murakabe vb.).
- Uc dini gelenegi esit saygiyla ele al.
- Yanitlarin sicak, insani ve dogal olsun.

${verseText ? 'Asagida bu konuyla ilgili kutsal kitap ayetleri ve tasavvuf ustadlarinin hikmetli sozleri verilmistir. Bunlari yanitinda kullan:\n\n' + verseText : ''}`;
}

async function _authHeader() {
  const session = await Supabase.ensureSession();
  if (!session) throw new Error('Oturum bulunamadi. Lutfen tekrar giris yapin.');
  return 'Bearer ' + session.access_token;
}

export async function sendMessage(messages, scriptureContext) {
  const systemPrompt = buildSystemPrompt(scriptureContext);
  const recent = messages.slice(-20);
  const body = JSON.stringify({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: recent.map((m) => ({ role: m.role, content: m.content })),
  });

  const doFetch = (auth) =>
    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
        apikey: SUPABASE_ANON_KEY,
      },
      body,
    });

  let auth = await _authHeader();
  let response = await doFetch(auth);

  if (response.status === 401) {
    const fresh = await Supabase._refreshSession();
    if (fresh) {
      auth = 'Bearer ' + fresh.access_token;
      response = await doFetch(auth);
    }
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('Oturum suresi doldu. Lutfen tekrar giris yapin.');
    if (response.status === 429) throw new Error('Cok fazla istek gonderildi. Lutfen biraz bekleyin.');
    throw new Error(err.error?.message || 'Baglanti hatasi: ' + response.status);
  }

  const data = await response.json();
  return data.content[0].text;
}

export async function generateDailyContent() {
  const systemPrompt = `Sen manevi bir rehbersin. Kullaniciya gunluk motivasyon ve manevi destek mesaji uretiyorsun.
Turkce yaz. Kisa ve etkili bir mesaj ver (2-3 cumle). Ardindan Kuran, Incil veya Tevrat'tan uygun bir ayet paylas.
JSON formatinda yanit ver:
{"content": "mesaj", "verse": {"source": "kaynak", "reference": "referans", "text": "ayet metni"}}`;

  const today = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  let auth;
  try {
    auth = await _authHeader();
  } catch {
    return null;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Bugun ' + today + '. Gunun manevi mesajini ver.' }],
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  try {
    const text = data.content[0].text;
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch {}
  return null;
}
