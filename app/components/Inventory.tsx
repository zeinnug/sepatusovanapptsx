import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import { debounce } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Define types for inventory item and state
interface Unit {
  unit_code: string;
  qr_code: string | null;
}

interface InventoryItem {
  id: number;
  name: string;
  brand: string;
  model: string;
  size: string;
  color: string;
  stock: number;
  selling_price: string;
  discount_price: string | null;
  units: Unit[];
}

interface InventoryState {
  products: InventoryItem[];
  searchTerm: string;
  sizeTerm: string;
  editItem: InventoryItem | null;
  brandCounts: { [key: string]: number };
  selectedBrand: string;
  isLoading: boolean;
  errorMessage: string;
  currentPage: number;
}

// Cache settings
const CACHE_KEY = 'inventory_products';
const CACHE_TIMESTAMP_KEY = 'inventory_cache_timestamp';
const CACHE_VALIDITY_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Komponen untuk item produk dengan memoization
const ProductItem = React.memo(({ item, index, onEdit, onDelete, showBrandHeader }: {
  item: InventoryItem;
  index: number;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: number) => void;
  showBrandHeader: boolean;
}) => {
  const [showQR, setShowQR] = useState(false);

  if (!item || !item.name || !item.id) {
    console.warn('Item produk tidak valid:', item);
    return null;
  }

  const brand = item.brand ? item.brand.replace(/['"]/g, '').replace(/\n/g, '') : 'Unknown';
  const model = item.model ? item.model.replace(/['"]/g, '').replace(/\n/g, '') : '-';
  const rowNumber = index + 1;
  const stock = item.stock || 0;
  const physicalStock = stock;
  const unit = item.units && item.units.length > 0 ? item.units[0] : { unit_code: '-', qr_code: null };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const unitCode = unit.unit_code || '-';
  const qrCodeData = unit.qr_code && isValidUrl(unit.qr_code)
    ? unit.qr_code
    : `https://testingaplikasi.tokosepatusovan.com/inventory/${item.id}/unit/${unitCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrCodeData)}&t=${Date.now()}`;

  return (
    <View style={styles.cardContainer}>
      {showBrandHeader && (
        <Text style={styles.brandHeader}>{brand.toUpperCase()}</Text>
      )}
      <View style={styles.productCard}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>No:</Text>
          <Text style={styles.cardValue}>{rowNumber}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Brand:</Text>
          <Text style={styles.cardValue} numberOfLines={1} ellipsizeMode="tail">{brand.toUpperCase()}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Model:</Text>
          <Text style={styles.cardValue} numberOfLines={1} ellipsizeMode="tail">{model.toUpperCase()}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Ukuran:</Text>
          <Text style={styles.cardValue} numberOfLines={1} ellipsizeMode="tail">{item.size || '-'}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Warna:</Text>
          <Text style={styles.cardValue} numberOfLines={1} ellipsizeMode="tail">{item.color ? item.color.toUpperCase() : '-'}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Stok:</Text>
          <Text style={[styles.cardValue, stock < 5 ? styles.lowStock : null]}>{stock}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Fisik:</Text>
          <Text style={styles.cardValue}>{physicalStock}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Harga:</Text>
          <Text style={styles.cardValue} numberOfLines={1} ellipsizeMode="tail">
            Rp {new Intl.NumberFormat('id-ID').format(parseFloat(item.selling_price) || 0)}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Diskon:</Text>
          <Text style={styles.cardValue} numberOfLines={1} ellipsizeMode="tail">
            {item.discount_price ? `Rp ${new Intl.NumberFormat('id-ID').format(parseFloat(item.discount_price))}` : '-'}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>QR:</Text>
          <TouchableOpacity onPress={() => setShowQR(!showQR)}>
            <Text style={styles.qrToggleText}>{showQR ? 'Sembunyikan QR' : 'Tampilkan QR'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Aksi:</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => onEdit(item)}>
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(item.id)}>
              <Text style={[styles.actionText, { color: '#DC2626' }]}>Hapus</Text>
            </TouchableOpacity>
          </View>
        </View>
        {showQR && (
          <View style={styles.qrContainer}>
            <Text style={styles.qrUnitCode}>Kode Unit: {unitCode}</Text>
            <Image
              source={{ uri: qrCodeUrl }}
              style={styles.qrCode}
              onError={(e) => console.error(`Gagal memuat QR code untuk produk ${item.id}: ${e.nativeEvent.error}`)}
            />
          </View>
        )}
      </View>
    </View>
  );
});

// Komponen utama InventoryScreen
export default function InventoryScreen() {
  const [state, setState] = useState<InventoryState>({
    products: [],
    searchTerm: '',
    sizeTerm: '',
    editItem: null,
    brandCounts: {},
    selectedBrand: 'all',
    isLoading: false,
    errorMessage: '',
    currentPage: 1,
  });

  const itemsPerPage = 20;

  // Sanitize string
  const sanitizeString = useCallback((str: string) => {
    return (str || '').replace(/['"]/g, '').replace(/\n/g, '');
  }, []);

  // Update brand counts
  const updateBrandCounts = useCallback((productList: InventoryItem[]) => {
    const counts = productList.reduce((acc, product) => {
      const brand = sanitizeString(product.brand) || 'Unknown';
      acc[brand] = (acc[brand] || 0) + (product.stock || 0);
      return acc;
    }, {} as { [key: string]: number });
    setState((prev) => ({ ...prev, brandCounts: counts }));
  }, [sanitizeString]);

  // Save state to AsyncStorage
  const saveStateToStorage = useCallback(async () => {
    try {
      await AsyncStorage.setItem('inventory_state', JSON.stringify({
        searchTerm: state.searchTerm,
        sizeTerm: state.sizeTerm,
        selectedBrand: state.selectedBrand,
        currentPage: state.currentPage,
      }));
    } catch (error) {
      console.error('Gagal menyimpan state ke AsyncStorage:', error);
    }
  }, [state.searchTerm, state.sizeTerm, state.selectedBrand, state.currentPage]);

  // Load state from AsyncStorage
  const loadStateFromStorage = useCallback(async () => {
    try {
      const savedState = await AsyncStorage.getItem('inventory_state');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        setState((prev) => ({
          ...prev,
          searchTerm: parsedState.searchTerm || '',
          sizeTerm: parsedState.sizeTerm || '',
          selectedBrand: parsedState.selectedBrand || 'all',
          currentPage: parsedState.currentPage || 1,
        }));
      }
    } catch (error) {
      console.error('Gagal memuat state dari AsyncStorage:', error);
    }
  }, []);

  // Save products to AsyncStorage
  const saveProductsToStorage = useCallback(async (products: InventoryItem[]) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(products));
      await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error('Gagal menyimpan produk ke AsyncStorage:', error);
    }
  }, []);

  // Load products from AsyncStorage
  const loadProductsFromStorage = useCallback(async () => {
    try {
      const cachedProducts = await AsyncStorage.getItem(CACHE_KEY);
      const timestamp = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);
      if (cachedProducts && timestamp) {
        const age = Date.now() - parseInt(timestamp, 10);
        if (age < CACHE_VALIDITY_DURATION) {
          const products = JSON.parse(cachedProducts);
          if (Array.isArray(products)) {
            setState((prev) => ({ ...prev, products, isLoading: false }));
            updateBrandCounts(products);
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Gagal memuat produk dari AsyncStorage:', error);
      return false;
    }
  }, [updateBrandCounts]);

  // Clear cache
  const clearCache = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
      await AsyncStorage.removeItem(CACHE_TIMESTAMP_KEY);
      console.log('Cache AsyncStorage berhasil dibersihkan');
    } catch (error) {
      console.error('Gagal membersihkan cache:', error);
    }
  }, []);

  // Fetch all products
  const fetchAllProducts = useCallback(async (search = '', size = '') => {
    setState((prev) => ({ ...prev, isLoading: true, errorMessage: '' }));
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setState((prev) => ({ ...prev, isLoading: false, errorMessage: 'Silakan login terlebih dahulu.' }));
        Alert.alert('Error', 'Silakan login terlebih dahulu.');
        return;
      }

      let allProducts: InventoryItem[] = [];
      let currentApiPage = 1;
      let lastPage = 1;
      const perPage = 100;
      const maxRetries = 3;

      do {
        let retries = 0;
        let success = false;
        while (retries < maxRetries && !success) {
          try {
            const url = new URL('https://testingaplikasi.tokosepatusovan.com/api/products');
            if (search) url.searchParams.set('search', search);
            if (size) url.searchParams.set('size', size);
            url.searchParams.set('page', currentApiPage.toString());
            url.searchParams.set('per_page', perPage.toString());
            url.searchParams.set('no_cache', 'true');
            url.searchParams.set('order_by', 'created_at');
            url.searchParams.set('sort', 'desc');

            const response = await fetch(url.toString(), {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Cache-Control': 'no-cache',
              },
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Gagal mengambil data (halaman ${currentApiPage}): ${response.status} ${errorText}`);
            }

            const data = await response.json();
            const productData = data.data?.products || [];
            if (!Array.isArray(productData)) {
              throw new Error('Data produk dari API tidak valid.');
            }

            const validProducts = productData.filter(
              (product: any) => product && product.id && product.name && typeof product.stock === 'number' && Array.isArray(product.units)
            );
            allProducts = [...allProducts, ...validProducts];
            lastPage = data.data?.pagination?.last_page || 1;
            success = true;
          } catch (error) {
            retries++;
            if (retries >= maxRetries) {
              throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
        currentApiPage++;
      } while (currentApiPage <= lastPage);

      if (allProducts.length === 0) {
        setState((prev) => ({ ...prev, isLoading: false, errorMessage: 'Tidak ada produk ditemukan.' }));
      } else {
        setState((prev) => ({ ...prev, products: allProducts, isLoading: false }));
        await saveProductsToStorage(allProducts);
        updateBrandCounts(allProducts);
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        errorMessage: 'Tidak dapat memuat data inventaris. Silakan coba lagi nanti.',
      }));
      Alert.alert('Error', 'Tidak dapat memuat data inventaris. Silakan coba lagi nanti.');
    }
  }, [saveProductsToStorage, updateBrandCounts]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = state.products;
    if (state.selectedBrand !== 'all') {
      filtered = filtered.filter((product) => sanitizeString(product.brand) === state.selectedBrand);
    }
    if (state.searchTerm.length >= 2) {
      const searchLower = sanitizeString(state.searchTerm).toLowerCase();
      filtered = filtered.filter(
        (product) =>
          (product.brand && sanitizeString(product.brand).toLowerCase().includes(searchLower)) ||
          (product.model && sanitizeString(product.model).toLowerCase().includes(searchLower))
      );
    }
    if (state.sizeTerm.length >= 1) {
      const sizeLower = sanitizeString(state.sizeTerm).toLowerCase();
      filtered = filtered.filter(
        (product) => product.size && sanitizeString(product.size).toLowerCase().includes(sizeLower)
      );
    }
    updateBrandCounts(filtered);
    return filtered;
  }, [state.products, state.searchTerm, state.sizeTerm, state.selectedBrand, sanitizeString, updateBrandCounts]);

  // Paginated products
  const paginatedProducts = useMemo(() => {
    const startIndex = (state.currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, state.currentPage]);

  // Total pages
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((search: string, size: string) => {
      if (search.length < 2 && size.length < 1 && state.selectedBrand === 'all') {
        Alert.alert('Peringatan', 'Masukkan minimal 2 karakter untuk brand/model atau 1 karakter untuk ukuran.');
        return;
      }
      fetchAllProducts(search, size);
    }, 500),
    [state.selectedBrand, fetchAllProducts]
  );

  // Handle search
  const handleSearch = useCallback(() => {
    setState((prev) => ({ ...prev, currentPage: 1 }));
    debouncedSearch(state.searchTerm, state.sizeTerm);
    saveStateToStorage();
  }, [state.searchTerm, state.sizeTerm, debouncedSearch, saveStateToStorage]);

  // Update product
  const handleUpdateItem = useCallback(async () => {
    if (!state.editItem) return;
    try {
      if (!state.editItem.name || !state.editItem.stock || !state.editItem.selling_price) {
        Alert.alert('Error', 'Nama, stok, dan harga jual wajib diisi.');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Silakan login terlebih dahulu.');
        return;
      }

      const [brand, ...modelParts] = sanitizeString(state.editItem.name).split(' ');
      const model = modelParts.join(' ') || '';

      const response = await fetch(`https://testingaplikasi.tokosepatusovan.com/api/products/${state.editItem.id}/`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          brand: brand || 'Unknown',
          model: model || '',
          sizes: [{ size: sanitizeString(state.editItem.size) || 'N/A', stock: state.editItem.stock }],
          color: sanitizeString(state.editItem.color) || null,
          selling_price: parseFloat(state.editItem.selling_price) || 0,
          discount_price: state.editItem.discount_price ? parseFloat(state.editItem.discount_price) : null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gagal memperbarui produk: ${response.status} ${errorText}`);
      }

      const updatedProduct = await response.json();
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) =>
          p.id === state.editItem!.id ? { ...p, ...updatedProduct.data, units: updatedProduct.data.units || [] } : p
        ),
        editItem: null,
        currentPage: 1,
        errorMessage: '',
      }));
      await saveProductsToStorage(state.products);
      Alert.alert('Sukses', 'Produk berhasil diperbarui.');
      await clearCache();
      await fetchAllProducts();
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Gagal memperbarui produk.');
    }
  }, [state.editItem, sanitizeString, clearCache, fetchAllProducts, saveProductsToStorage]);

  // Delete product
  const handleDeleteItem = useCallback((id: number) => {
    Alert.alert(
      'Konfirmasi',
      'Apakah Anda yakin ingin menghapus produk ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) {
                Alert.alert('Error', 'Silakan login terlebih dahulu.');
                return;
              }

              const response = await fetch(`https://testingaplikasi.tokosepatusovan.com/api/products/${id}/`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  'Cache-Control': 'no-cache',
                },
              });

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gagal menghapus produk: ${response.status} ${errorText}`);
              }

              const updatedProducts = state.products.filter((p) => p.id !== id);
              setState((prev) => ({
                ...prev,
                products: updatedProducts,
                currentPage: 1,
                errorMessage: '',
              }));
              await saveProductsToStorage(updatedProducts);
              Alert.alert('Sukses', 'Produk berhasil dihapus.');
              await clearCache();
              await fetchAllProducts();
            } catch (error) {
              Alert.alert('Error', (error as Error).message || 'Gagal menghapus produk.');
            }
          },
        },
      ]
    );
  }, [clearCache, fetchAllProducts, state.products, saveProductsToStorage]);

  // Sync on focus
  useFocusEffect(
    useCallback(() => {
      const checkAndSync = async () => {
        await loadStateFromStorage();
        const cacheLoaded = await loadProductsFromStorage();
        if (!cacheLoaded) {
          await clearCache();
          await fetchAllProducts();
        }
      };
      checkAndSync();
    }, [clearCache, fetchAllProducts, loadProductsFromStorage, loadStateFromStorage])
  );

  // Save state whenever it changes
  useFocusEffect(
    useCallback(() => {
      saveStateToStorage();
    }, [saveStateToStorage])
  );

  // Render header component
  const renderHeader = useCallback(() => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Manajemen Inventaris</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => fetchAllProducts(state.searchTerm, state.sizeTerm)}>
          <Ionicons name="refresh" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Info Cards */}
      <View style={styles.infoContainer}>
        <Text style={styles.sectionTitle}>Informasi Inventaris</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <View style={styles.infoCardGradient}>
                <View style={styles.infoCardHeader}>
                  <Text style={styles.infoCardTitle}>Total Produk</Text>
                </View>
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardValue}>{filteredProducts.length}</Text>
                </View>
              </View>
            </View>
            <View style={styles.infoCard}>
              <View style={styles.infoCardGradient}>
                <View style={styles.infoCardHeader}>
                  <Text style={styles.infoCardTitle}>Stok Menipis</Text>
                </View>
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardValue}>{filteredProducts.filter((p) => p && p.stock < 5).length}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <View style={styles.infoCardGradient}>
                <View style={styles.infoCardHeader}>
                  <Text style={styles.infoCardTitle}>Total Unit</Text>
                </View>
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardValue}>{filteredProducts.reduce((sum, p) => sum + (p && p.stock || 0), 0)}</Text>
                </View>
              </View>
            </View>
            <View style={styles.infoCard}>
              <View style={styles.infoCardGradient}>
                <View style={styles.infoCardHeader}>
                  <Text style={styles.infoCardTitle}>Jumlah Unit per Brand</Text>
                </View>
                <View style={styles.infoCardContent}>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={state.selectedBrand}
                      onValueChange={(value) => setState((prev) => ({ ...prev, selectedBrand: value, currentPage: 1 }))}
                      style={styles.picker}
                    >
                      <Picker.Item label={`Semua (${Object.keys(state.brandCounts).length} brand)`} value="all" />
                      {Object.entries(state.brandCounts).map(([brand, count]) => (
                        <Picker.Item
                          key={brand}
                          label={`${sanitizeString(brand).toUpperCase()} (${count} unit)`}
                          value={brand}
                        />
                      ))}
                    </Picker>
                  </View>
                  {state.selectedBrand !== 'all' && (
                    <Text style={styles.infoCardValue}>
                      {sanitizeString(state.selectedBrand).toUpperCase()}: {state.brandCounts[state.selectedBrand]} unit
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari brand atau model..."
            placeholderTextColor="#9CA3AF"
            value={state.searchTerm}
            onChangeText={(text) => setState((prev) => ({ ...prev, searchTerm: text, currentPage: 1 }))}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="resize" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari ukuran..."
            placeholderTextColor="#9CA3AF"
            value={state.sizeTerm}
            onChangeText={(text) => setState((prev) => ({ ...prev, sizeTerm: text, currentPage: 1 }))}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <TouchableOpacity style={styles.actionButton} onPress={handleSearch}>
          <Text style={styles.actionButtonText}>Cari</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Form */}
      {state.editItem && (
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Edit Produk</Text>
          <TextInput
            style={styles.input}
            placeholder="Nama Produk (Brand Model)"
            placeholderTextColor="#9CA3AF"
            value={state.editItem.name}
            onChangeText={(text) => setState((prev) => ({ ...prev, editItem: { ...prev.editItem!, name: text } }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Stok"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            value={state.editItem.stock.toString()}
            onChangeText={(text) => setState((prev) => ({ ...prev, editItem: { ...prev.editItem!, stock: parseInt(text) || 0 } }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Ukuran"
            placeholderTextColor="#9CA3AF"
            value={state.editItem.size}
            onChangeText={(text) => setState((prev) => ({ ...prev, editItem: { ...prev.editItem!, size: text } }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Warna"
            placeholderTextColor="#9CA3AF"
            value={state.editItem.color}
            onChangeText={(text) => setState((prev) => ({ ...prev, editItem: { ...prev.editItem!, color: text } }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Harga Jual"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            value={state.editItem.selling_price}
            onChangeText={(text) => setState((prev) => ({ ...prev, editItem: { ...prev.editItem!, selling_price: text } }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Harga Diskon"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            value={state.editItem.discount_price || ''}
            onChangeText={(text) => setState((prev) => ({ ...prev, editItem: { ...prev.editItem!, discount_price: text } }))}
          />
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleUpdateItem}>
              <Text style={styles.actionButtonText}>Simpan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => setState((prev) => ({ ...prev, editItem: null }))}
            >
              <Text style={styles.actionButtonText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  ), [state, filteredProducts, handleSearch, handleUpdateItem, fetchAllProducts, sanitizeString]);

  // Render footer component
  const renderFooter = useCallback(() => (
    <>
      {state.isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Memuat produk...</Text>
        </View>
      )}
      {state.errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{state.errorMessage}</Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => fetchAllProducts(state.searchTerm, state.sizeTerm)}>
            <Text style={styles.actionButtonText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      )}
      {filteredProducts.length === 0 && !state.isLoading && !state.errorMessage && (
        <View style={styles.emptyContainer}>
          <Text style={styles.noDataText}>Tidak ada produk ditemukan.</Text>
        </View>
      )}
      {totalPages > 1 && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[styles.actionButton, state.currentPage === 1 && styles.disabledButton]}
            onPress={() => setState((prev) => ({ ...prev, currentPage: Math.max(prev.currentPage - 1, 1) }))}
            disabled={state.currentPage === 1}
          >
            <Text style={[styles.actionButtonText, state.currentPage === 1 && { color: '#9CA3AF' }]}>Sebelumnya</Text>
          </TouchableOpacity>
          <Text style={styles.paginationText}>
            Halaman {state.currentPage} dari {totalPages}
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, state.currentPage === totalPages && styles.disabledButton]}
            onPress={() => setState((prev) => ({ ...prev, currentPage: Math.min(prev.currentPage + 1, totalPages) }))}
            disabled={state.currentPage === totalPages}
          >
            <Text style={[styles.actionButtonText, state.currentPage === totalPages && { color: '#9CA3AF' }]}>Selanjutnya</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  ), [state, filteredProducts, totalPages, fetchAllProducts]);

  // Render item
  const renderItem = useCallback(
    ({ item, index }: { item: InventoryItem; index: number }) => {
      const showBrandHeader =
        index === 0 || (paginatedProducts[index - 1] && paginatedProducts[index - 1].brand !== item.brand);
      return (
        <ProductItem
          item={item}
          index={(state.currentPage - 1) * itemsPerPage + index}
          onEdit={(item) => setState((prev) => ({ ...prev, editItem: item }))}
          onDelete={handleDeleteItem}
          showBrandHeader={showBrandHeader}
        />
      );
    },
    [state.currentPage, handleDeleteItem, paginatedProducts]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredProducts.length > 0 ? paginatedProducts : []}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        initialNumToRender={itemsPerPage}
        maxToRenderPerBatch={itemsPerPage}
        windowSize={2}
        removeClippedSubviews={true}
        extraData={state.products}
        getItemLayout={(data, index) => ({
          length: 300, // Approximate height of a card including QR code
          offset: 300 * index,
          index,
        })}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

// Styles
const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  listContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  refreshButton: {
    padding: 12,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  infoContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    width: width - 32,
    alignSelf: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 16,
    color: '#1E3A8A',
    textTransform: 'uppercase',
  },
  infoGrid: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
    flexShrink: 1,
  },
  infoCard: {
    width: (width - 32 - 32 - 12) / 2,
    minHeight: 140,
    flexShrink: 1,
  },
  infoCardGradient: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#FFFFFF',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  infoCardHeader: {
    backgroundColor: '#EFF6FF',
    padding: 8,
  },
  infoCardTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  infoCardContent: {
    backgroundColor: '#1F2937',
    padding: 16,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  pickerContainer: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'visible',
  },
  picker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 100 : 40,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    marginVertical: 8,
  },
  infoCardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'center',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 150,
  },
  searchIcon: {
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#1F2937',
  },
  form: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  cardContainer: {
    width: width - 32,
    alignSelf: 'center',
    marginBottom: 12,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    width: 80,
  },
  cardValue: {
    fontSize: 12,
    color: '#1F2937',
    flex: 1,
    textAlign: 'left',
  },
  lowStock: {
    color: '#DC2626',
  },
  qrToggleText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
  },
  actionText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '500',
  },
  brandHeader: {
    backgroundColor: '#EFF6FF',
    color: '#1F2937',
    fontWeight: '600',
    padding: 12,
    textTransform: 'uppercase',
    fontSize: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  qrContainer: {
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrUnitCode: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 8,
  },
  qrCode: {
    width: 100,
    height: 100,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#DC2626',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  noDataText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#1E3A8A',
    fontWeight: '600',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  actionButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cancelButton: {
    backgroundColor: '#DC2626',
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  paginationText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
});