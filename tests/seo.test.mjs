import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRobots, buildSitemap, metadataForPath, organizationJsonLd } from '../worker/seo.js';

test('robots references runtime origin and blocks private areas', () => {
  const text = buildRobots('https://huanghe.example');
  assert.match(text, /Disallow: \/admin\//);
  assert.match(text, /Disallow: \/api\//);
  assert.match(text, /Sitemap: https:\/\/huanghe\.example\/sitemap\.xml/);
});

test('sitemap uses absolute URLs and adds future published models', () => {
  const xml = buildSitemap('https://huanghe.example', [
    { slug: 'eagle', updated_at: '2026-08-13 10:00:00' },
    { slug: 'city-150', updated_at: '2026-08-12 09:00:00' },
  ]);
  assert.match(xml, /https:\/\/huanghe\.example\/eagle\.html/);
  assert.match(xml, /https:\/\/huanghe\.example\/motorcycle\.html\?model=city-150/);
  assert.match(xml, /<lastmod>2026-08-12<\/lastmod>/);
  assert.equal((xml.match(/motorcycle\.html\?model=eagle/g) || []).length, 0);
});

test('model metadata is unique and canonical', () => {
  const meta = metadataForPath('https://huanghe.example', '/motorcycles/city-150', {
    slug: 'city-150',
    name: 'City 150',
    description_en: 'A Lubumbashi motorcycle for daily movement.',
    image_key: 'city-150/photo.webp',
  });
  assert.equal(meta.canonical, 'https://huanghe.example/motorcycle.html?model=city-150');
  assert.match(meta.title, /City 150 Motorcycle/);
  assert.equal(meta.image, 'https://huanghe.example/media/city-150/photo.webp');
});

test('organization markup does not invent a street address', () => {
  const data = organizationJsonLd('https://huanghe.example');
  assert.equal(data.name, 'Huanghe Motors');
  assert.equal(data.address.addressLocality, 'Lubumbashi');
  assert.equal(data.address.addressCountry, 'CD');
  assert.equal('streetAddress' in data.address, false);
});
