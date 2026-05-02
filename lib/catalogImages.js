export const CATALOG_IMAGE_BUCKET = 'catalog_images';
export const MAX_CATALOG_IMAGES = 3;

export function normalizeImages(images, max = MAX_CATALOG_IMAGES) {
  if (!Array.isArray(images)) return [];
  return images
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .slice(0, max);
}

export function mergeImages(existing, incoming, max = MAX_CATALOG_IMAGES) {
  const base = normalizeImages(existing, max);
  const add = normalizeImages(incoming, max);
  const merged = [];
  const seen = new Set();
  for (const url of [...base, ...add]) {
    if (seen.has(url)) continue;
    seen.add(url);
    merged.push(url);
    if (merged.length >= max) break;
  }
  return merged;
}

function sanitizePathSegment(value, fallback) {
  const raw = String(value || '').trim().toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function sanitizeFileName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!cleaned) return '';
  return cleaned;
}

function isJpgFile(file) {
  if (!file) return false;
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  return name.endsWith('.jpg') || name.endsWith('.jpeg') || type === 'image/jpeg';
}

function ensureJpgName(name) {
  const cleaned = sanitizeFileName(name);
  if (!cleaned) return '';
  const lower = cleaned.toLowerCase();
  if (lower.endsWith('.jpg')) return cleaned;
  if (lower.endsWith('.jpeg')) return cleaned.replace(/\.jpeg$/i, '.jpg');
  return `${cleaned}.jpg`;
}

export async function uploadCatalogImages({ supabase, files, brand, model }) {
  const list = Array.from(files || []);
  if (!list.length) return { urls: [] };

  const safeBrand = sanitizePathSegment(brand, 'brand');
  const safeModel = sanitizePathSegment(model, 'model');
  const urls = [];

  for (const file of list) {
    if (!isJpgFile(file)) {
      return { error: 'Only JPG images are allowed.' };
    }
    const safeName = ensureJpgName(file.name);
    if (!safeName) {
      return { error: 'Invalid file name.' };
    }
    const path = `public/${safeBrand}/${safeModel}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from(CATALOG_IMAGE_BUCKET)
      .upload(path, file, { cacheControl: '31536000', upsert: true });

    if (error) {
      return { error: error.message };
    }

    const { data } = supabase.storage.from(CATALOG_IMAGE_BUCKET).getPublicUrl(path);
    if (data?.publicUrl) {
      urls.push(data.publicUrl);
    }
  }

  return { urls };
}
