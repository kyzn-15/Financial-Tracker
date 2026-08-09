import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import * as api from './services/api';
import {
  cacheCategories,
  clearSession,
  enqueue,
  getCachedCategories,
  getQueue,
  getSavedSession,
  persistReceipt,
  removeLocalReceipt,
  removeQueuedItem,
  saveSession,
} from './services/localQueue';
import { DEFAULT_CATEGORIES, isSupportedReceipt, nowUTC8 } from './utils';

function newQueueId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [online, setOnline] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    setPendingCount((await getQueue()).length);
  }, []);

  const syncQueue = useCallback(async () => {
    if (!authenticated || syncingRef.current) return;

    const network = await NetInfo.fetch();
    if (!network.isConnected) return;

    const queue = await getQueue();
    if (!queue.length) return;

    syncingRef.current = true;
    setSyncing(true);
    try {
      for (const item of queue) {
        if (item.type === 'expense') {
          await api.createExpense(item.data);
        } else {
          await api.uploadReceipt(item.receipt);
          removeLocalReceipt(item.receipt.uri);
        }
        await removeQueuedItem(item.id);
      }
      setNotice('Saved offline items have been synced.');
    } catch (error) {
      setNotice(`Still saved on this phone: ${error.message}`);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      refreshPendingCount();
    }
  }, [authenticated, refreshPendingCount]);

  const refreshCategories = useCallback(async () => {
    const cached = await getCachedCategories();
    if (cached.length) setCategories(cached);

    if (!(await NetInfo.fetch()).isConnected) return;
    try {
      const response = await api.getCategories();
      const names = response.map((category) => category.name);
      setCategories(names);
      await cacheCategories(names);
    } catch {
      // The cached categories keep the expense form usable offline.
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function boot() {
      const [savedSession, network] = await Promise.all([getSavedSession(), NetInfo.fetch()]);
      if (!active) return;

      setOnline(Boolean(network.isConnected));
      if (savedSession) {
        setAuthenticated(true);
        if (network.isConnected) {
          try {
            await api.getSession();
          } catch (error) {
            if (error.status === 401) {
              await clearSession();
              if (active) setAuthenticated(false);
            }
          }
        }
      }
      await refreshPendingCount();
      if (active) setReady(true);
    }

    boot();
    return () => { active = false; };
  }, [refreshPendingCount]);

  useEffect(() => NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected));
    if (state.isConnected) syncQueue();
  }), [syncQueue]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncQueue();
    });
    return () => subscription.remove();
  }, [syncQueue]);

  useEffect(() => {
    if (!authenticated) return;
    refreshCategories();
    syncQueue();
  }, [authenticated, refreshCategories, syncQueue]);

  const saveReceipt = useCallback(async (asset) => {
    if (!isSupportedReceipt(asset.mimeType)) {
      throw new Error('Choose a JPEG, PNG, WebP, HEIC, or HEIF receipt image.');
    }
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      throw new Error('Receipt images must be 10 MB or smaller.');
    }

    const receipt = await persistReceipt(asset);
    const item = { id: newQueueId(), type: 'receipt', receipt };

    if (online) {
      try {
        await api.uploadReceipt(receipt);
        removeLocalReceipt(receipt.uri);
        setNotice('Receipt uploaded.');
        return;
      } catch {
        // Saving to the queue prevents a temporary backend or network failure from losing the photo.
      }
    }

    await enqueue(item);
    await refreshPendingCount();
    setNotice('Receipt saved on this phone and queued for upload.');
  }, [online, refreshPendingCount]);

  useEffect(() => {
    if (!authenticated) return;
    ImagePicker.getPendingResultAsync().then((result) => {
      if (!result?.canceled && result?.assets?.[0]) {
        saveReceipt(result.assets[0]).catch((error) => setNotice(error.message));
      }
    });
  }, [authenticated, saveReceipt]);

  async function handleLogin(username, pin) {
    await api.login(username, pin);
    await saveSession();
    setAuthenticated(true);
    setNotice('Signed in.');
  }

  async function handleLogout() {
    try {
      if (online) await api.logout();
    } catch {
      // Clearing this device's session is still the expected local sign-out behavior.
    }
    await clearSession();
    setAuthenticated(false);
    setNotice('Signed out. Offline items remain saved on this phone.');
  }

  if (!ready) {
    return <LoadingScreen />;
  }

  if (!authenticated) {
    return <LoginScreen online={online} onLogin={handleLogin} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>FT</Text></View>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>{online ? 'Connected' : 'Offline mode'}</Text>
            <Text style={styles.title}>Financial Tracker</Text>
          </View>
          <Pressable onPress={handleLogout} hitSlop={10}><Text style={styles.signOut}>Sign out</Text></Pressable>
        </View>

        <View style={[styles.status, online ? styles.statusOnline : styles.statusOffline]}>
          <View style={[styles.statusDot, online ? styles.dotOnline : styles.dotOffline]} />
          <Text style={styles.statusText}>
            {syncing ? 'Syncing saved items…' : pendingCount ? `${pendingCount} item${pendingCount === 1 ? '' : 's'} saved on this phone` : online ? 'Everything is synced' : 'New entries will be saved locally'}
          </Text>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <ExpenseForm categories={categories} online={online} onSaved={refreshPendingCount} onNotice={setNotice} />
        <ReceiptForm online={online} onSave={saveReceipt} />
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loading}><ActivityIndicator size="large" color="#6979e8" /></View>
  );
}

function LoginScreen({ online, onLogin }) {
  const [step, setStep] = useState('username');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submitPin() {
    if (pin.length !== 6) {
      setError('Enter your 6-digit PIN.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onLogin(username.trim(), pin);
    } catch (loginError) {
      setError(loginError.message || 'Could not sign in.');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.loginScreen}>
        <View style={styles.loginCard}>
          <View style={styles.loginMark}><Text style={styles.brandMarkText}>FT</Text></View>
          <Text style={styles.kicker}>Secure access</Text>
          <Text style={styles.loginTitle}>Financial Tracker</Text>
          <Text style={styles.loginSubtitle}>{step === 'username' ? 'Enter your username to continue.' : 'Enter your 6-digit PIN.'}</Text>
          <Text style={[styles.connectionText, online ? styles.connectionOnline : styles.connectionOffline]}>{online ? 'Backend available' : 'An internet connection is needed to sign in'}</Text>

          {step === 'username' ? (
            <>
              <Text style={styles.label}>Username</Text>
              <TextInput style={styles.input} value={username} autoCapitalize="none" autoCorrect={false} onChangeText={(value) => { setUsername(value); setError(''); }} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <ActionButton label="Continue" onPress={() => {
                if (username.trim()) {
                  setError('');
                  setStep('pin');
                } else {
                  setError('Enter your username.');
                }
              }} />
            </>
          ) : (
            <>
              <Text style={styles.label}>PIN</Text>
              <TextInput style={styles.input} value={pin} keyboardType="number-pad" secureTextEntry maxLength={6} onChangeText={(value) => { setPin(value.replace(/\D/g, '')); setError(''); }} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.loginActions}>
                <ActionButton secondary label="Back" onPress={() => { setPin(''); setError(''); setStep('username'); }} />
                <ActionButton label={submitting ? 'Checking…' : 'Unlock'} disabled={submitting || !online} onPress={submitPin} />
              </View>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function ExpenseForm({ categories, online, onSaved, onNotice }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [saving, setSaving] = useState(false);

  async function submitExpense() {
    const amount = Number(price);
    if (!name.trim() || !category || !Number.isFinite(amount) || amount <= 0) {
      onNotice('Enter an expense name, category, and amount greater than zero.');
      return;
    }

    const item = {
      id: newQueueId(),
      type: 'expense',
      data: { name: name.trim(), category, price: amount, currency, timestamp: nowUTC8() },
    };

    setSaving(true);
    try {
      if (online) {
        try {
          await api.createExpense(item.data);
          onNotice('Expense saved.');
        } catch {
          await enqueue(item);
          onNotice('Expense saved on this phone and queued for upload.');
        }
      } else {
        await enqueue(item);
        onNotice('Expense saved on this phone and queued for upload.');
      }
      setName('');
      setPrice('');
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Add expense</Text>
      <Text style={styles.cardHint}>The current UTC+8 time is used. It will sync when the backend is reachable.</Text>
      <Text style={styles.label}>Expense name</Text>
      <TextInput style={styles.input} value={name} placeholder="e.g. Nasi Goreng" placeholderTextColor="#9b9fac" onChangeText={setName} />
      <Text style={styles.label}>Category</Text>
      <View style={styles.chips}>
        {categories.map((item) => <Pressable key={item} style={[styles.chip, category === item && styles.chipSelected]} onPress={() => setCategory(item)}><Text style={[styles.chipText, category === item && styles.chipTextSelected]}>{item}</Text></Pressable>)}
      </View>
      <Text style={styles.label}>Currency</Text>
      <View style={styles.currencyRow}>
        {['MYR', 'IDR'].map((item) => <Pressable key={item} style={[styles.currencyButton, currency === item && styles.currencySelected]} onPress={() => setCurrency(item)}><Text style={[styles.currencyText, currency === item && styles.currencyTextSelected]}>{item}</Text></Pressable>)}
      </View>
      <Text style={styles.label}>Amount ({currency})</Text>
      <TextInput style={styles.input} value={price} placeholder="0.00" placeholderTextColor="#9b9fac" keyboardType="decimal-pad" onChangeText={setPrice} />
      <ActionButton label={saving ? 'Saving…' : online ? 'Save expense' : 'Save offline'} disabled={saving} onPress={submitExpense} />
    </View>
  );
}

function ReceiptForm({ online, onSave }) {
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  async function choose(source) {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to take a receipt photo.');
        return;
      }
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;

    setPreview(result.assets[0].uri);
    setSaving(true);
    try {
      await onSave(result.assets[0]);
    } catch (error) {
      Alert.alert('Could not save receipt', error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Add receipt</Text>
      <Text style={styles.cardHint}>Receipt images are kept locally until they can be uploaded. The server keeps uploaded receipts for 7 days.</Text>
      {preview ? <Image source={{ uri: preview }} style={styles.preview} /> : null}
      <View style={styles.receiptActions}>
        <ActionButton secondary label="Choose image" disabled={saving} onPress={() => choose('library')} />
        <ActionButton label={saving ? 'Saving…' : online ? 'Take photo' : 'Save photo offline'} disabled={saving} onPress={() => choose('camera')} />
      </View>
    </View>
  );
}

function ActionButton({ label, onPress, disabled, secondary }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.actionButton, secondary && styles.actionSecondary, disabled && styles.actionDisabled]}><Text style={[styles.actionText, secondary && styles.actionSecondaryText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#e8ebf3' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8ebf3' },
  screen: { padding: 20, paddingBottom: 40 },
  loginScreen: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8ebf3' },
  loginCard: { width: '100%', maxWidth: 420, padding: 28, borderRadius: 26, backgroundColor: '#e8ebf3', shadowColor: '#a4a9b8', shadowOffset: { width: 8, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerCopy: { flex: 1, marginLeft: 12 },
  brandMark: { height: 46, width: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6979e8', shadowColor: '#a4a9b8', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  loginMark: { height: 62, width: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6979e8', marginBottom: 22 },
  brandMarkText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  kicker: { color: '#6979e8', fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: '#292d3e', fontSize: 20, fontWeight: '800', marginTop: 2 },
  signOut: { color: '#6979e8', fontWeight: '700' },
  status: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 12, shadowColor: '#fff', shadowOffset: { width: -3, height: -3 }, shadowOpacity: 0.7, shadowRadius: 7, elevation: 2 },
  statusOnline: { backgroundColor: '#e0f3e7' }, statusOffline: { backgroundColor: '#fff0d9' },
  statusDot: { height: 9, width: 9, borderRadius: 9, marginRight: 9 }, dotOnline: { backgroundColor: '#4aa66a' }, dotOffline: { backgroundColor: '#d68d2d' },
  statusText: { color: '#3e4750', flex: 1, fontSize: 13, fontWeight: '600' },
  notice: { color: '#4b5364', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  card: { backgroundColor: '#e8ebf3', borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#a4a9b8', shadowOffset: { width: 7, height: 7 }, shadowOpacity: 0.42, shadowRadius: 14, elevation: 6 },
  cardTitle: { color: '#292d3e', fontSize: 20, fontWeight: '800' }, cardHint: { color: '#737a8c', fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 18 },
  label: { color: '#4b5364', fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 12 },
  input: { minHeight: 48, borderRadius: 13, backgroundColor: '#e8ebf3', color: '#292d3e', paddingHorizontal: 14, fontSize: 16, shadowColor: '#a4a9b8', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#e8ebf3', shadowColor: '#a4a9b8', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.28, shadowRadius: 4, elevation: 1 }, chipSelected: { backgroundColor: '#6979e8' }, chipText: { color: '#596174', fontSize: 12, fontWeight: '600' }, chipTextSelected: { color: '#fff' },
  currencyRow: { flexDirection: 'row', gap: 10 }, currencyButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#e8ebf3', shadowColor: '#a4a9b8', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 2 }, currencySelected: { backgroundColor: '#6979e8' }, currencyText: { color: '#596174', fontWeight: '800' }, currencyTextSelected: { color: '#fff' },
  actionButton: { flex: 1, marginTop: 22, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6979e8', shadowColor: '#a4a9b8', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.35, shadowRadius: 7, elevation: 3 }, actionSecondary: { backgroundColor: '#e8ebf3', borderWidth: 1, borderColor: '#d4d8e4' }, actionDisabled: { opacity: 0.55 }, actionText: { color: '#fff', fontSize: 15, fontWeight: '800' }, actionSecondaryText: { color: '#6979e8' },
  loginTitle: { color: '#292d3e', fontSize: 27, fontWeight: '800', marginTop: 6 }, loginSubtitle: { color: '#737a8c', fontSize: 15, marginTop: 8, marginBottom: 10 }, connectionText: { fontSize: 12, fontWeight: '700', marginBottom: 14 }, connectionOnline: { color: '#4aa66a' }, connectionOffline: { color: '#c47d20' }, error: { color: '#bc4253', marginTop: 10, fontSize: 13, fontWeight: '600' }, loginActions: { flexDirection: 'row', gap: 10 },
  receiptActions: { flexDirection: 'row', gap: 10 }, preview: { width: '100%', height: 210, borderRadius: 14, marginTop: 8, resizeMode: 'contain', backgroundColor: '#dce0ea' },
});
