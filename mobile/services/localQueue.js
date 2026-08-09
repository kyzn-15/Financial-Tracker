import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

const QUEUE_KEY = '@financial-tracker/mobile-queue';
const CATEGORY_KEY = '@financial-tracker/mobile-categories';
const SESSION_KEY = '@financial-tracker/mobile-session';

async function read(key, fallback) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function getQueue() {
  return read(QUEUE_KEY, []);
}

export async function enqueue(item) {
  const queue = await getQueue();
  queue.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function removeQueuedItem(id) {
  const queue = await getQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter((item) => item.id !== id)));
}

export function getCachedCategories() {
  return read(CATEGORY_KEY, []);
}

export function cacheCategories(categories) {
  return AsyncStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
}

export function getSavedSession() {
  return AsyncStorage.getItem(SESSION_KEY);
}

export function saveSession() {
  return AsyncStorage.setItem(SESSION_KEY, '1');
}

export function clearSession() {
  return AsyncStorage.removeItem(SESSION_KEY);
}

export async function persistReceipt(asset) {
  const directory = new Directory(Paths.document, 'pending-receipts');
  if (!directory.exists) directory.create();

  const extension = asset.mimeType?.split('/')[1] || 'jpg';
  const target = new File(directory, `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`);
  await new File(asset.uri).copy(target);

  return {
    uri: target.uri,
    name: target.name,
    mimeType: asset.mimeType,
  };
}

export function removeLocalReceipt(uri) {
  const file = new File(uri);
  if (file.exists) file.delete();
}
