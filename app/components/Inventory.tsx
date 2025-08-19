import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

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
    : `http://192.168.1.8:8000/inventory/${item.id}/unit/${unitCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrCodeData)}&t=${Date.now()}`;

  return (
    <View>
      {showBrandHeader && (
        <Text style={styles.brandHeader}>{brand.toUpperCase()}</Text>
      )}
      <View style={[styles.item, index % 2 === 0 ? styles.itemEven : styles.itemOdd]}>
        <Text style={[styles.itemText, styles.itemNo]}>{rowNumber}</Text>
        <View style={[styles.itemTextContainer, styles.itemBrand]}>
          <Text style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">{brand.toUpperCase()}</Text>
        </View>
        <View style={[styles.itemTextContainer, styles.itemModel]}>
          <Text style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">{model.toUpperCase()}</Text>
        </View>
        <Text style={[styles.itemText, styles.itemSize]} numberOfLines={1} ellipsizeMode="tail">{item.size || '-'}</Text>
        <Text style={[styles.itemText, styles.itemColor]} numberOfLines={1} ellipsizeMode="tail">{item.color ? item.color.toUpperCase() : '-'}</Text>
        <Text style={[styles.itemText, styles.itemStock, stock < 5 ? styles.lowStock : null]}>{stock}</Text>
        <Text style={[styles.itemText, styles.itemPhysical]}>{physicalStock}</Text>
        <Text style={[styles.itemText, styles.itemPrice]} numberOfLines={1} ellipsizeMode="tail">
          Rp {new Intl.NumberFormat('id-ID').format(parseFloat(item.selling_price) || 0)}
        </Text>
        <Text style={[styles.itemText, styles.itemDiscount]} numberOfLines={1} ellipsizeMode="tail">
          {item.discount_price ? `Rp ${new Intl.NumberFormat('id-ID').format(parseFloat(item.discount_price))}` : '-'}
        </Text>
        <TouchableOpacity onPress={() => setShowQR(!showQR)} style={styles.qrToggle}>
          <Text style={styles.qrToggleText}>{showQR ? 'Sembunyikan QR' : 'Tampilkan QR'}</Text>
        </TouchableOpacity>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => onEdit(item)}>
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(item.id)}>
            <Text style={[styles.actionText, { color: '#ef4444' }]}>Hapus</Text>
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

  // Clear cache
  const clearCache = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('cache_valid');
      const cacheKey = 'all_products';
      const count = await AsyncStorage.getItem(`${cacheKey}_count`);
      if (count) {
        const total = parseInt(count, 10);
        for (let i = 0; i < total; i += 500) {
          await AsyncStorage.removeItem(`${cacheKey}_${i}`);
        }
        await AsyncStorage.removeItem(`${cacheKey}_count`);
      }
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
            const url = new URL('http://192.168.1.8:8000/api/products/');
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
        await clearCache();
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        errorMessage: 'Tidak dapat memuat data inventaris. Silakan coba lagi nanti.',
      }));
      Alert.alert('Error', 'Tidak dapat memuat data inventaris. Silakan coba lagi nanti.');
    }
  }, [clearCache]);

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
  }, [state.searchTerm, state.sizeTerm, debouncedSearch]);

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

      const response = await fetch(`http://192.168.1.8:8000/api/products/${state.editItem.id}/`, {
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
      Alert.alert('Sukses', 'Produk berhasil diperbarui.');
      await clearCache();
      await fetchAllProducts();
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Gagal memperbarui produk.');
    }
  }, [state.editItem, sanitizeString, clearCache, fetchAllProducts]);

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

              const response = await fetch(`http://192.168.1.8:8000/api/products/${id}/`, {
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

              setState((prev) => ({
                ...prev,
                products: prev.products.filter((p) => p.id !== id),
                currentPage: 1,
                errorMessage: '',
              }));
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
  }, [clearCache, fetchAllProducts]);

  // Sync on focus
  useFocusEffect(
    useCallback(() => {
      const checkAndSync = async () => {
        await clearCache();
        await fetchAllProducts();
      };
      checkAndSync();
    }, [clearCache, fetchAllProducts])
  );

  // Render item
  const renderItem = useCallback(
    ({ item, index }: { item: InventoryItem; index: number }) => {
      const showBrandHeader =
        index === 0 || (paginatedProducts[index - 1] && paginatedProducts[index - 1].brand !== item.brand);
      return (
        <View style={styles.tableRowContainer}>
          <ProductItem
            item={item}
            index={(state.currentPage - 1) * itemsPerPage + index}
            onEdit={(item) => setState((prev) => ({ ...prev, editItem: item }))}
            onDelete={handleDeleteItem}
            showBrandHeader={showBrandHeader}
          />
        </View>
      );
    },
    [state.currentPage, handleDeleteItem, paginatedProducts]
  );

  // Retry fetch
  const handleRetry = useCallback(() => {
    fetchAllProducts(state.searchTerm, state.sizeTerm);
  }, [fetchAllProducts, state.searchTerm, state.sizeTerm]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manajemen Inventaris</Text>
        <TouchableOpacity onPress={handleRetry}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Info Cards */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Informasi Inventaris</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Total Produk</Text>
            <Text style={styles.infoCardValue}>{filteredProducts.length}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Stok Menipis</Text>
            <Text style={styles.infoCardValue}>{filteredProducts.filter((p) => p && p.stock < 5).length}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Total Unit</Text>
            <Text style={styles.infoCardValue}>{filteredProducts.reduce((sum, p) => sum + (p && p.stock || 0), 0)}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Jumlah Unit per Brand</Text>
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
              {state.selectedBrand !== 'all' && (
                <Text style={styles.infoCardValue}>
                  {sanitizeString(state.selectedBrand).toUpperCase()}: {state.brandCounts[state.selectedBrand]} unit
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari brand atau model..."
            value={state.searchTerm}
            onChangeText={(text) => setState((prev) => ({ ...prev, searchTerm: text, currentPage: 1 }))}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="resize" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari ukuran..."
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
          <Text style={styles.formTitle}>Edit Produk</Text>
          <TextInput
            style={styles.input}
            placeholder="Nama Produk (Brand Model)"
            value={state.editItem.name}
            onChangeText={(text) => setState((prev) => ({ ...prev, editItem: { ...prev.editItem!, name: text } }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Stok"
            keyboardType="numeric"
            value={state.editItem.stock.toString()}
            onChangeText={(text) => setState((prev) => ({ ...prev, editItem: { ...prev.editItem!, stock: parseInt(text) || 0 } }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Ukuran"
            value={state.editItem.size}
            onChangeText={(text) => setState((prev) => ({ ...prev, editItem: { ...prev.editItem!, size: text } }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Warna"
            value={state.editItem.color}
            onChangeText={(text) => setState((prev) => ({ ...prev, editItem: { ...prev.editItem!, color: text } }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Harga Jual"
            keyboardType="numeric"
            value={state.editItem.selling_price}
            onChangeText={(text) => setState((prev) => ({ ...prev, editItem: { ...prev.editItem!, selling_price: text } }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Harga Diskon"
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

      {/* Product Table */}
      <View style={styles.tableContainer}>
        {state.isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f97316" />
            <Text style={styles.loadingText}>Memuat produk...</Text>
          </View>
        )}
        {state.errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{state.errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Coba Lagi</Text>
            </TouchableOpacity>
          </View>
        )}
        {filteredProducts.length === 0 && !state.isLoading && !state.errorMessage && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Tidak ada produk ditemukan.</Text>
          </View>
        )}
        {filteredProducts.length > 0 && (
          <ScrollView horizontal={true} showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
            <View style={styles.tableContent}>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerText, styles.headerNo]}>No</Text>
                <Text style={[styles.headerText, styles.headerBrand]}>Brand</Text>
                <Text style={[styles.headerText, styles.headerModel]}>Model</Text>
                <Text style={[styles.headerText, styles.headerSize]}>Ukuran</Text>
                <Text style={[styles.headerText, styles.headerColor]}>Warna</Text>
                <Text style={[styles.headerText, styles.headerStock]}>Stok</Text>
                <Text style={[styles.headerText, styles.headerPhysical]}>Fisik</Text>
                <Text style={[styles.headerText, styles.headerPrice]}>Harga</Text>
                <Text style={[styles.headerText, styles.headerDiscount]}>Diskon</Text>
                <Text style={[styles.headerText, styles.headerQR]}>QR</Text>
                <Text style={[styles.headerText, styles.headerActions]}>Aksi</Text>
              </View>
              <FlatList
                data={paginatedProducts}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                scrollEnabled={false}
                initialNumToRender={itemsPerPage}
                maxToRenderPerBatch={itemsPerPage}
                windowSize={2}
                removeClippedSubviews={true}
                extraData={state.products}
                getItemLayout={(data, index) => ({
                  length: 60,
                  offset: 60 * index,
                  index,
                })}
              />
            </View>
          </ScrollView>
        )}
        {totalPages > 1 && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[styles.pageButton, state.currentPage === 1 && styles.disabledButton]}
              onPress={() => setState((prev) => ({ ...prev, currentPage: Math.max(prev.currentPage - 1, 1) }))}
              disabled={state.currentPage === 1}
            >
              <Text style={[styles.pageButtonText, state.currentPage === 1 && { color: '#ccc' }]}>Sebelumnya</Text>
            </TouchableOpacity>
            <Text style={styles.paginationText}>
              Halaman {state.currentPage} dari {totalPages}
            </Text>
            <TouchableOpacity
              style={[styles.pageButton, state.currentPage === totalPages && styles.disabledButton]}
              onPress={() => setState((prev) => ({ ...prev, currentPage: Math.min(prev.currentPage + 1, totalPages) }))}
              disabled={state.currentPage === totalPages}
            >
              <Text style={[styles.pageButtonText, state.currentPage === totalPages && { color: '#ccc' }]}>Selanjutnya</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// Styles
const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f97316',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  infoContainer: {
    backgroundColor: '#292929',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  infoCard: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 12,
    width: (width - 48) / 2 - 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 16,
  },
  infoCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  infoCardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
  },
  pickerContainer: {
    marginTop: 8,
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: 8,
    height: 40,
    color: '#333',
  },
  searchContainer: {
    backgroundColor: '#292929',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    color: '#333',
  },
  form: {
    backgroundColor: '#292929',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
  },
  tableContainer: {
    backgroundColor: '#292929',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tableScroll: {
    flexGrow: 0,
  },
  tableContent: {
    minWidth: 720,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f97316',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  tableRowContainer: {
    minWidth: 720,
  },
  headerText: {
    color: '#000',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 12,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  headerNo: { width: 50 },
  headerBrand: { width: 120 },
  headerModel: { width: 120 },
  headerSize: { width: 80 },
  headerColor: { width: 80 },
  headerStock: { width: 60 },
  headerPhysical: { width: 60 },
  headerPrice: { width: 100 },
  headerDiscount: { width: 100 },
  headerQR: { width: 100 },
  headerActions: { width: 100 },
  item: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  itemEven: {
    backgroundColor: '#fff',
  },
  itemOdd: {
    backgroundColor: '#f3f4f6',
  },
  itemText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#333',
    paddingVertical: 8,
  },
  itemTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemNo: { width: 50 },
  itemBrand: { width: 120 },
  itemModel: { width: 120 },
  itemSize: { width: 80 },
  itemColor: { width: 80 },
  itemStock: { width: 60 },
  itemPhysical: { width: 60 },
  itemPrice: { width: 100 },
  itemDiscount: { width: 100 },
  lowStock: { color: '#ef4444' },
  qrToggle: {
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrToggleText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '500',
  },
  actions: {
    width: 100,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '500',
  },
  brandHeader: {
    backgroundColor: '#f97316',
    color: '#000',
    fontWeight: '600',
    padding: 12,
    textTransform: 'uppercase',
    fontSize: 12,
    borderRadius: 8,
    marginBottom: 8,
    minWidth: 720,
  },
  qrContainer: {
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginBottom: 8,
    marginHorizontal: 8,
  },
  qrUnitCode: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
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
    color: '#ef4444',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  pageButton: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f97316',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  pageButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
  },
  paginationText: {
    fontSize: 14,
    color: '#fff',
  },
  actionButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#6b7280',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});