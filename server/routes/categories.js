import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
  reorderCategories,
} from '../services/categories.js';

const router = Router();
const MAX_CATEGORY_NAME_LENGTH = 60;

function normalizeCategoryName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name && name.length <= MAX_CATEGORY_NAME_LENGTH ? name : null;
}

function parseCategoryId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

router.get('/', async (_req, res) => {
  try {
    res.json(await listCategories());
  } catch (err) {
    console.error('GET /api/categories error:', err);
    res.status(500).json({ error: 'Failed to load categories.' });
  }
});

router.post('/', async (req, res) => {
  const name = normalizeCategoryName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Category name must be between 1 and 60 characters.' });

  try {
    await createCategory(name);
    return res.status(201).json(await listCategories());
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to add category.' });
  }
});

router.put('/reorder', async (req, res) => {
  const ids = req.body?.ids;
  const isValid = Array.isArray(ids)
    && ids.length > 0
    && ids.every((id) => parseCategoryId(id))
    && new Set(ids.map(Number)).size === ids.length;
  if (!isValid) return res.status(400).json({ error: 'A valid category order is required.' });

  try {
    await reorderCategories(ids.map(Number));
    return res.json(await listCategories());
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to reorder categories.' });
  }
});

router.put('/:id', async (req, res) => {
  const id = parseCategoryId(req.params.id);
  const name = normalizeCategoryName(req.body?.name);
  if (!id) return res.status(400).json({ error: 'Invalid category id.' });
  if (!name) return res.status(400).json({ error: 'Category name must be between 1 and 60 characters.' });

  try {
    const renamed = await renameCategory(id, name);
    if (!renamed) return res.status(404).json({ error: 'Category not found.' });
    return res.json(await listCategories());
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to rename category.' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseCategoryId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid category id.' });

  try {
    const removed = await deleteCategory(id);
    if (!removed) return res.status(404).json({ error: 'Category not found.' });
    return res.json(await listCategories());
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to remove category.' });
  }
});

export default router;
