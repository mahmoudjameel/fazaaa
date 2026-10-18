/**
 * ينشر المقالات والهاشتاقات الجاهزة في Firestore مرة واحدة.
 * يتخطى الموجود حتى لا يتكرر. التشغيل: node scripts/seed-seo-content.mjs
 */
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  limit,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { SEO_ARTICLES, SEO_HASHTAGS } from '../src/seo/seoContent.js';

const app = initializeApp({
  apiKey: 'AIzaSyBLzVh55r-BaJ5cfUwm4q-c0XZKvOkyGOI',
  authDomain: 'fazaproject-c5059.firebaseapp.com',
  projectId: 'fazaproject-c5059',
  storageBucket: 'fazaproject-c5059.firebasestorage.app',
  messagingSenderId: '939604805877',
  appId: '1:939604805877:web:63efb92f1a5f450c6a9dbc',
});
const db = getFirestore(app);

function keywords(value) {
  return String(value || '')
    .split(/[,،]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function exists(coll, field, value) {
  const snap = await getDocs(query(collection(db, coll), where(field, '==', value), limit(1)));
  return !snap.empty;
}

let tagsAdded = 0;
let articlesAdded = 0;

for (const hashtag of SEO_HASHTAGS) {
  if (await exists('seo_hashtags', 'tag', hashtag.tag)) continue;
  await addDoc(collection(db, 'seo_hashtags'), {
    tag: hashtag.tag,
    label: hashtag.label,
    slug: hashtag.slug,
    keywords: keywords(hashtag.keywords),
    seoTitle: hashtag.seoTitle,
    seoDescription: hashtag.seoDescription,
    intro: hashtag.intro,
    body: hashtag.intro,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  tagsAdded += 1;
}

for (const article of SEO_ARTICLES) {
  if (await exists('articles', 'slug', article.slug)) continue;
  await addDoc(collection(db, 'articles'), {
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    content: article.content,
    coverImage: '',
    hashtags: article.hashtags,
    keywords: keywords(article.keywords),
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    published: true,
    showOnLanding: true,
    publishedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  articlesAdded += 1;
}

console.log(`added hashtags: ${tagsAdded}, articles: ${articlesAdded}`);
process.exit(0);
