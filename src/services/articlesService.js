import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { SEO_ARTICLES, SEO_HASHTAGS } from '../seo/seoContent';

const ARTICLES_COLLECTION = 'articles';
const HASHTAGS_COLLECTION = 'seo_hashtags';

/** تحويل العنوان لـ slug مناسب للعربية والإنجليزية */
export function slugifyArticleTitle(text) {
  const base = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `article-${Date.now()}`;
}

/** تطبيع هاشتاق: بدون # ومسافات */
export function normalizeHashtag(tag) {
  return String(tag || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '_')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9_]/g, '');
}

export function parseTagsInput(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(normalizeHashtag).filter(Boolean))];
  }
  return [
    ...new Set(
      String(value || '')
        .split(/[,،\n#]+/)
        .map(normalizeHashtag)
        .filter(Boolean)
    ),
  ];
}

function mapArticleDoc(d) {
  const data = d.data() || {};
  return {
    id: d.id,
    ...data,
    hashtags: Array.isArray(data.hashtags) ? data.hashtags.map(normalizeHashtag).filter(Boolean) : [],
    keywords: Array.isArray(data.keywords)
      ? data.keywords.map((k) => String(k).trim()).filter(Boolean)
      : [],
  };
}

/** كل المقالات (لوحة التحكم) */
export async function getAllArticles() {
  try {
    const snap = await getDocs(query(collection(db, ARTICLES_COLLECTION), orderBy('createdAt', 'desc')));
    return snap.docs.map(mapArticleDoc);
  } catch (error) {
    // فهرس مركب قد لا يكون جاهزاً — fallback بدون orderBy
    console.warn('getAllArticles orderBy failed, falling back:', error?.message);
    const snap = await getDocs(collection(db, ARTICLES_COLLECTION));
    return snap.docs
      .map(mapArticleDoc)
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const tb = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return tb - ta;
      });
  }
}

/** مقالات منشورة للعرض العام */
export async function getPublishedArticles({ max = 50, hashtag = null, landingOnly = false } = {}) {
  let list = [];
  try {
    const q = query(
      collection(db, ARTICLES_COLLECTION),
      where('published', '==', true),
      orderBy('publishedAt', 'desc'),
      limit(Math.min(max * 2, 100))
    );
    const snap = await getDocs(q);
    list = snap.docs.map(mapArticleDoc);
  } catch (error) {
    console.warn('getPublishedArticles query failed, falling back:', error?.message);
    const all = await getAllArticles();
    list = all.filter((a) => a.published !== false);
  }

  if (landingOnly) {
    list = list.filter((a) => a.showOnLanding !== false);
  }
  if (hashtag) {
    const tag = normalizeHashtag(hashtag);
    list = list.filter((a) => (a.hashtags || []).includes(tag));
  }

  return list.slice(0, max);
}

export async function getArticleBySlug(slug) {
  if (!slug) return null;
  try {
    const q = query(collection(db, ARTICLES_COLLECTION), where('slug', '==', slug), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return mapArticleDoc(snap.docs[0]);
  } catch (error) {
    console.error('getArticleBySlug error:', error);
    throw error;
  }
}

export async function getArticleById(id) {
  const snap = await getDoc(doc(db, ARTICLES_COLLECTION, id));
  if (!snap.exists()) return null;
  return mapArticleDoc(snap);
}

async function assertUniqueSlug(slug, excludeId = null) {
  const q = query(collection(db, ARTICLES_COLLECTION), where('slug', '==', slug), limit(5));
  const snap = await getDocs(q);
  const conflict = snap.docs.find((d) => d.id !== excludeId);
  if (conflict) {
    throw new Error('الرابط (slug) مستخدم لمقال آخر — غيّره ليكون فريداً');
  }
}

export async function addArticle(data) {
  const title = String(data.title || '').trim();
  if (!title) throw new Error('عنوان المقال مطلوب');

  let slug = slugifyArticleTitle(data.slug || title);
  await assertUniqueSlug(slug);

  const hashtags = parseTagsInput(data.hashtags);
  const keywords = parseTagsInput(data.keywords).map((k) => k.replace(/_/g, ' '));
  const published = data.published !== false;

  const payload = {
    title,
    slug,
    excerpt: String(data.excerpt || '').trim(),
    content: String(data.content || '').trim(),
    coverImage: String(data.coverImage || '').trim(),
    hashtags,
    keywords,
    seoTitle: String(data.seoTitle || '').trim(),
    seoDescription: String(data.seoDescription || '').trim(),
    published,
    showOnLanding: data.showOnLanding !== false,
    publishedAt: published ? serverTimestamp() : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, ARTICLES_COLLECTION), payload);
  return { success: true, id: ref.id, slug };
}

export async function updateArticle(id, data) {
  if (!id) throw new Error('معرّف المقال مطلوب');
  const updateData = { updatedAt: serverTimestamp() };

  if (data.title !== undefined) updateData.title = String(data.title).trim();
  if (data.slug !== undefined) {
    const slug = slugifyArticleTitle(data.slug);
    await assertUniqueSlug(slug, id);
    updateData.slug = slug;
  }
  if (data.excerpt !== undefined) updateData.excerpt = String(data.excerpt).trim();
  if (data.content !== undefined) updateData.content = String(data.content).trim();
  if (data.coverImage !== undefined) updateData.coverImage = String(data.coverImage).trim();
  if (data.hashtags !== undefined) updateData.hashtags = parseTagsInput(data.hashtags);
  if (data.keywords !== undefined) {
    updateData.keywords = parseTagsInput(data.keywords).map((k) => k.replace(/_/g, ' '));
  }
  if (data.seoTitle !== undefined) updateData.seoTitle = String(data.seoTitle).trim();
  if (data.seoDescription !== undefined) updateData.seoDescription = String(data.seoDescription).trim();
  if (data.showOnLanding !== undefined) updateData.showOnLanding = !!data.showOnLanding;

  if (data.published !== undefined) {
    updateData.published = !!data.published;
    if (data.published) {
      const existing = await getArticleById(id);
      if (!existing?.publishedAt) {
        updateData.publishedAt = serverTimestamp();
      }
    }
  }

  await updateDoc(doc(db, ARTICLES_COLLECTION, id), updateData);
  return { success: true };
}

export async function deleteArticle(id) {
  await deleteDoc(doc(db, ARTICLES_COLLECTION, id));
  return { success: true };
}

// ——— هاشتاقات SEO ———

function mapHashtagDoc(d) {
  const data = d.data() || {};
  return {
    id: d.id,
    tag: normalizeHashtag(data.tag),
    label: data.label || data.tag || '',
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    slug: String(data.slug || '').trim(),
    seoTitle: data.seoTitle || '',
    seoDescription: data.seoDescription || '',
    intro: data.intro || '',
    body: data.body || '',
    active: data.active !== false,
    ...data,
  };
}

export function slugifyServicePage(text) {
  const latin = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return latin;
}

export async function getSeoHashtags({ activeOnly = false } = {}) {
  try {
    const snap = await getDocs(query(collection(db, HASHTAGS_COLLECTION), orderBy('tag', 'asc')));
    let list = snap.docs.map(mapHashtagDoc);
    if (activeOnly) list = list.filter((h) => h.active !== false);
    return list;
  } catch (error) {
    console.warn('getSeoHashtags fallback:', error?.message);
    const snap = await getDocs(collection(db, HASHTAGS_COLLECTION));
    let list = snap.docs.map(mapHashtagDoc);
    if (activeOnly) list = list.filter((h) => h.active !== false);
    return list.sort((a, b) => String(a.tag).localeCompare(String(b.tag), 'ar'));
  }
}

export async function addSeoHashtag(data) {
  const tag = normalizeHashtag(data.tag || data.label);
  if (!tag) throw new Error('الهاشتاق مطلوب');

  const existing = await getDocs(query(collection(db, HASHTAGS_COLLECTION), where('tag', '==', tag), limit(1)));
  if (!existing.empty) throw new Error('هذا الهاشتاق موجود مسبقاً');

  const ref = await addDoc(collection(db, HASHTAGS_COLLECTION), {
    tag,
    label: String(data.label || tag).trim(),
    keywords: parseTagsInput(data.keywords).map((k) => k.replace(/_/g, ' ')),
    slug: slugifyServicePage(data.slug),
    seoTitle: String(data.seoTitle || '').trim(),
    seoDescription: String(data.seoDescription || '').trim(),
    intro: String(data.intro || '').trim(),
    body: String(data.body || '').trim(),
    active: data.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { success: true, id: ref.id, tag };
}

export async function updateSeoHashtag(id, data) {
  const updateData = { updatedAt: serverTimestamp() };
  if (data.tag !== undefined) updateData.tag = normalizeHashtag(data.tag);
  if (data.label !== undefined) updateData.label = String(data.label).trim();
  if (data.keywords !== undefined) {
    updateData.keywords = parseTagsInput(data.keywords).map((k) => k.replace(/_/g, ' '));
  }
  if (data.slug !== undefined) updateData.slug = slugifyServicePage(data.slug);
  if (data.seoTitle !== undefined) updateData.seoTitle = String(data.seoTitle).trim();
  if (data.seoDescription !== undefined) updateData.seoDescription = String(data.seoDescription).trim();
  if (data.intro !== undefined) updateData.intro = String(data.intro).trim();
  if (data.body !== undefined) updateData.body = String(data.body).trim();
  if (data.active !== undefined) updateData.active = !!data.active;
  await updateDoc(doc(db, HASHTAGS_COLLECTION, id), updateData);
  return { success: true };
}

export async function deleteSeoHashtag(id) {
  await deleteDoc(doc(db, HASHTAGS_COLLECTION, id));
  return { success: true };
}

/** ينشر مقالات وهاشتاقات فزاعين الجاهزة في اللوحة، ويتخطى الموجود. */
export async function publishReadySeoContent() {
  const [articles, hashtags] = await Promise.all([getAllArticles(), getSeoHashtags()]);
  const articleSlugs = new Set(articles.map((item) => item.slug));
  const tags = new Set(hashtags.map((item) => item.tag));
  let addedArticles = 0;
  let addedHashtags = 0;

  for (const hashtag of SEO_HASHTAGS) {
    if (tags.has(hashtag.tag)) continue;
    await addSeoHashtag(hashtag);
    addedHashtags += 1;
  }
  for (const article of SEO_ARTICLES) {
    if (articleSlugs.has(article.slug)) continue;
    await addArticle({ ...article, published: true, showOnLanding: true });
    addedArticles += 1;
  }
  return { addedArticles, addedHashtags };
}

export async function getSeoPageBySlug(slug) {
  const clean = slugifyServicePage(slug);
  if (!clean) return null;
  const snap = await getDocs(
    query(collection(db, HASHTAGS_COLLECTION), where('slug', '==', clean), limit(1))
  );
  if (snap.empty) return null;
  const page = mapHashtagDoc(snap.docs[0]);
  if (page.active === false) return null;
  if (!page.body && !page.intro) return null;
  return page;
}
