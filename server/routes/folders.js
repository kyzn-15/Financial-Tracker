import { Router } from 'express';
import { createFolder, deleteFolder, listFolders, renameFolder } from '../services/folders.js';

const router = Router();
const MAX_FOLDER_NAME_LENGTH = 60;

function normalizeFolderName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name && name.length <= MAX_FOLDER_NAME_LENGTH ? name : null;
}

function parseFolderId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

router.get('/', async (_req, res) => {
  try {
    res.json(await listFolders());
  } catch (err) {
    console.error('GET /api/folders error:', err);
    res.status(500).json({ error: 'Failed to load folders.' });
  }
});

router.post('/', async (req, res) => {
  const name = normalizeFolderName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Folder name must be between 1 and 60 characters.' });

  try {
    const created = await createFolder(name);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to add folder.' });
  }
});

router.put('/:id', async (req, res) => {
  const id = parseFolderId(req.params.id);
  const name = normalizeFolderName(req.body?.name);
  if (!id) return res.status(400).json({ error: 'Invalid folder.' });
  if (!name) return res.status(400).json({ error: 'Folder name must be between 1 and 60 characters.' });

  try {
    const renamed = await renameFolder(id, name);
    if (!renamed) return res.status(404).json({ error: 'Folder not found.' });
    return res.json(await listFolders());
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to rename folder.' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseFolderId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid folder.' });

  try {
    const removed = await deleteFolder(id);
    if (!removed) return res.status(404).json({ error: 'Folder not found.' });
    return res.json(await listFolders());
  } catch (err) {
    console.error('DELETE /api/folders/:id error:', err);
    return res.status(500).json({ error: 'Failed to delete folder.' });
  }
});

export default router;
