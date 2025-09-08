import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios, { AxiosError } from 'axios';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Define types
type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  TransactionIndex: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Unit {
  product_id: number;
  product_name: string;
  brand: string;
  model: string;
  color: string;
  size: string;
  unit_code: string;
  qr_code: string | null;
  selling_price: number;
  discount_price: number | null;
  stock: number;
  is_active: number;
}

interface CartItem {
  product_id: number;
  name: string;
  brand: string;
  model: string;
  color: string;
  size: string;
  unit_code: string;
  selling_price: number;
  discount_price: number | null;
  quantity: number;
}

interface ApiResponse {
  success: boolean;
  data: {
    products: {
      id: number;
      name: string;
      brand: string;
      model: string;
      color: string;
      size: string;
      selling_price: string;
      discount_price: string | null;
      stock: number;
      units: {
        unit_code: string;
        qr_code: string | null;
        is_active: number;
      }[];
    }[];
    pagination?: {
      last_page: number;
    };
  };
}

interface ApiErrorResponse {
  message?: string;
  errors?: Record<string, string[]>;
}

interface Props {
  navigation: NavigationProp;
}

// Custom debounce function
const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = { leading: true, trailing: false }
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | number | null = null;

  return (...args: Parameters<T>) => {
    const later = () => {
      timeout = null;
      if (options.trailing) {
        func(...args);
      }
    };

    const callNow = options.leading && !timeout;

    if (timeout !== null) {
      clearTimeout(timeout as NodeJS.Timeout);
    }

    timeout = setTimeout(later, wait);

    if (callNow) {
      func(...args);
    }
  };
};

const TransactionCreate: React.FC<Props> = ({ navigation }) => {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [searchResults, setSearchResults] = useState<Unit[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [cardType, setCardType] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [newTotal, setNewTotal] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [popupTitle, setPopupTitle] = useState<string>('');
  const [popupMessage, setPopupMessage] = useState<string>('');
  const [popupType, setPopupType] = useState<'success' | 'error'>('success');
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem('darkMode').then((value) => {
      if (value) setDarkMode(JSON.parse(value));
    });
    fetchUnits();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setErrorMessage('Token tidak ditemukan. Silakan login kembali.');
        throw new Error('Token autentikasi tidak ditemukan.');
      }

      let allProducts: Unit[] = [];
      let currentPage = 1;
      let lastPage = 1;
      const perPage = 100;

      do {
        const url = new URL('https://testingaplikasi.tokosepatusovan.com/api/products');
        url.searchParams.set('page', currentPage.toString());
        url.searchParams.set('per_page', perPage.toString());
        url.searchParams.set('no_cache', 'true');
        url.searchParams.set('order_by', 'created_at');
        url.searchParams.set('sort', 'desc');

        const response = await axios.get<ApiResponse>(url.toString(), {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
          },
        });

        const productData = response.data.data?.products || [];
        if (!Array.isArray(productData)) {
          throw new Error('Data produk dari API tidak valid');
        }

        const validProducts = productData.filter(
          (product) =>
            product &&
            product.id &&
            product.name &&
            typeof product.stock === 'number' &&
            Array.isArray(product.units)
        );

        const mappedProducts = validProducts.flatMap((product) => {
          const units = product.units || [];
          return units
            .filter((unit) => unit.is_active === 1)
            .map((unit) => ({
              product_id: product.id,
              product_name: product.name,
              brand: product.brand || 'Unknown',
              model: product.model || '-',
              color: product.color || '-',
              size: product.size || '-',
              selling_price: parseFloat(product.selling_price) || 0,
              discount_price: product.discount_price
                ? parseFloat(product.discount_price)
                : null,
              unit_code: unit.unit_code || `UNIT-${product.id}`,
              qr_code: unit.qr_code || `https://testingaplikasi.tokosepatusovan.com/inventory/${product.id}/unit/${unit.unit_code}`,
              stock: product.stock || 0,
              is_active: unit.is_active,
            }));
        });

        allProducts = [...allProducts, ...mappedProducts];
        lastPage = response.data.data?.pagination?.last_page || 1;
        currentPage++;
      } while (currentPage <= lastPage);

      if (allProducts.length === 0) {
        setErrorMessage('Tidak ada unit produk aktif tersedia dari API.');
      } else {
        setAvailableUnits(allProducts);
        setSearchResults([]);
      }
    } catch (error: unknown) {
      const axiosError = error as AxiosError<ApiErrorResponse>;
      const message =
        axiosError.response?.data?.message ||
        'Gagal mengambil data produk. Silakan coba lagi.';
      setErrorMessage(message);
      if (axiosError.response?.status === 401) {
        await AsyncStorage.removeItem('token');
        navigation.navigate('Login');
      }
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  const showPopupMessage = useCallback((title: string, message: string, type: 'success' | 'error', navigateOnClose: boolean = false) => {
    setPopupTitle(title);
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
    if (navigateOnClose) {
      setTimeout(() => {
        setShowPopup(false);
        navigation.navigate('TransactionIndex');
      }, 1000);
    }
  }, [navigation]);

  const searchUnits = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const results = availableUnits
      .filter(
        (unit) =>
          unit.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          unit.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          unit.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          unit.color?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          unit.size?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          unit.unit_code?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 20);
    setSearchResults(results);
  }, [searchQuery, availableUnits]);

  const addToCart = useCallback(
    debounce((unit: Unit) => {
      if (cart.some((item) => item.unit_code.toLowerCase() === unit.unit_code.toLowerCase())) {
        showPopupMessage(
          'Unit Sudah Ditambahkan',
          `Unit dengan kode "${unit.unit_code}" sudah ada di keranjang.`,
          'error'
        );
        return;
      }
      if (unit.stock <= 0) {
        showPopupMessage(
          'Stok Habis',
          `Unit "${unit.unit_code}" tidak memiliki stok.`,
          'error'
        );
        return;
      }
      if (unit.is_active !== 1) {
        showPopupMessage(
          'Unit Tidak Aktif',
          `Unit "${unit.unit_code}" sudah tidak aktif.`,
          'error'
        );
        return;
      }
      const newCartItem: CartItem = {
        product_id: unit.product_id,
        name: unit.product_name,
        brand: unit.brand,
        model: unit.model,
        color: unit.color,
        size: unit.size,
        selling_price: unit.selling_price,
        discount_price: unit.discount_price,
        unit_code: unit.unit_code,
        quantity: 1,
      };
      setCart((prev) => [...prev, newCartItem]);
      setSearchQuery('');
      setSearchResults([]);
      setShowProductDropdown(false);
      showPopupMessage(
        'Unit Ditambahkan',
        `Unit "${unit.unit_code}" berhasil ditambahkan ke keranjang!`,
        'success'
      );
    }, 500, { leading: true, trailing: false }),
    [cart, showPopupMessage]
  );

  const removeItem = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const calculateSubtotal = useCallback((): number => {
    return cart.reduce((total, item) => {
      const price = item.discount_price ?? item.selling_price;
      return total + price * item.quantity;
    }, 0);
  }, [cart]);

  const calculateDiscount = useCallback((): number => {
    const subtotal = calculateSubtotal();
    const total = parseFloat(newTotal) || 0;
    return Math.max(0, subtotal - total);
  }, [newTotal, calculateSubtotal]);

  const calculateTotal = useCallback((): number => {
    const total = parseFloat(newTotal);
    return Math.max(0, isNaN(total) ? calculateSubtotal() : total);
  }, [newTotal, calculateSubtotal]);

  const validateForm = useCallback((): boolean => {
    if (cart.length === 0) {
      showPopupMessage(
        'Keranjang Kosong',
        'Tambahkan unit produk terlebih dahulu.',
        'error'
      );
      return false;
    }
    if (!paymentMethod) {
      showPopupMessage(
        'Metode Pembayaran Kosong',
        'Silakan pilih metode pembayaran!',
        'error'
      );
      return false;
    }
    if (paymentMethod === 'debit' && !cardType) {
      showPopupMessage(
        'Tipe Kartu Kosong',
        'Silakan pilih tipe kartu untuk metode pembayaran Debit!',
        'error'
      );
      return false;
    }
    const total = parseFloat(newTotal);
    if (newTotal === '' || isNaN(total) || total < 0) {
      showPopupMessage(
        'Harga Baru Tidak Valid',
        'Harga baru harus diisi dan tidak boleh kurang dari 0.',
        'error'
      );
      return false;
    }
    if (total > calculateSubtotal()) {
      showPopupMessage(
        'Harga Baru Tidak Valid',
        'Harga baru tidak boleh melebihi subtotal.',
        'error'
      );
      return false;
    }
    return true;
  }, [cart, paymentMethod, cardType, newTotal, calculateSubtotal, showPopupMessage]);

  const submitTransaction = useCallback(async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setErrorMessage('Token tidak ditemukan. Silakan login kembali.');
        throw new Error('Token autentikasi tidak ditemukan.');
      }

      const payload = {
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        customer_email: customerEmail || null,
        payment_method: paymentMethod,
        card_type: paymentMethod === 'debit' ? cardType : null,
        notes: notes || null,
        discount_amount: calculateDiscount(),
        products: cart.map((item) => ({
          unit_code: item.unit_code.toUpperCase(),
          discount_price: item.discount_price,
          quantity: item.quantity,
        })),
      };

      const response = await axios.post('https://testingaplikasi.tokosepatusovan.com/api/transactions/', payload, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Gagal membuat transaksi.');
      }

      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setPaymentMethod('');
      setCardType('');
      setNotes('');
      setNewTotal('');

      showPopupMessage('Transaksi Berhasil', 'Transaksi telah berhasil dibuat!', 'success', true);
    } catch (error: unknown) {
      const axiosError = error as AxiosError<ApiErrorResponse>;
      const message =
        axiosError.response?.data?.message ||
        'Gagal membuat transaksi. Silakan coba lagi.';
      showPopupMessage('Gagal Membuat Transaksi', message, 'error');
      if (axiosError.response?.status === 401) {
        await AsyncStorage.removeItem('token');
        navigation.navigate('Login');
      }
    } finally {
      setLoading(false);
    }
  }, [
    validateForm,
    customerName,
    customerPhone,
    customerEmail,
    paymentMethod,
    cardType,
    notes,
    cart,
    calculateDiscount,
    showPopupMessage,
    navigation,
  ]);

  const formatRupiah = useCallback((amount: number): string => {
    return `Rp ${new Intl.NumberFormat('id-ID').format(amount || 0)}`;
  }, []);

  const handleBarcodeScanned = useCallback(
    async ({ type, data }: { type: string; data: string }) => {
      if (hasScanned) return;
      setHasScanned(true);

      const scannedCode = data.trim();
      let unitCode: string | null = null;
      if (scannedCode.startsWith('https://testingaplikasi.tokosepatusovan.com/inventory/')) {
        const match = scannedCode.match(/\/unit\/([^/]+)$/);
        if (match && match[1]) {
          unitCode = match[1];
        }
      } else {
        unitCode = scannedCode;
      }

      if (availableUnits.length === 0) {
        showPopupMessage(
          'Data Produk Belum Dimuat',
          'Daftar produk belum dimuat. Coba muat ulang data.',
          'error'
        );
        await fetchUnits();
        setShowCamera(false);
        setHasScanned(false);
        return;
      }

      const unit = availableUnits.find(
        (u) =>
          (unitCode && u.unit_code.toLowerCase() === unitCode.toLowerCase()) ||
          (u.qr_code && u.qr_code.toLowerCase() === scannedCode.toLowerCase())
      );

      if (unit) {
        if (unit.is_active !== 1) {
          showPopupMessage(
            'Unit Tidak Aktif',
            `Unit "${unit.unit_code}" sudah tidak aktif.`,
            'error'
          );
        } else {
          addToCart(unit);
        }
      } else {
        showPopupMessage(
          'Unit Tidak Ditemukan',
          `Kode unit "${unitCode || scannedCode}" tidak ditemukan.`,
          'error'
        );
      }

      setShowCamera(false);
      setHasScanned(false);
    },
    [hasScanned, availableUnits, addToCart, fetchUnits, showPopupMessage]
  );

  const renderUnit = useCallback(
    ({ item }: { item: Unit }) => (
      <TouchableOpacity
        style={[styles.productCard, darkMode && styles.productCardDark]}
        onPress={() => addToCart(item)}
        activeOpacity={0.7}
      >
        <View style={styles.productCardContent}>
          <Text style={[styles.productName, darkMode && styles.textDark]}>
            {item.product_name || 'Nama tidak tersedia'}
          </Text>
          <Text style={[styles.productDetails, darkMode && styles.textDark]}>
            Brand: {item.brand || '-'}, Model: {item.model || '-'}
          </Text>
          <Text style={[styles.productDetails, darkMode && styles.textDark]}>
            Warna: {item.color || '-'}, Ukuran: {item.size || '-'}, Kode: {item.unit_code || '-'}
          </Text>
          <Text style={[styles.productStock, darkMode && styles.textDark]}>
            Stok: {item.stock || 0}
          </Text>
          <Text style={[styles.productPrice, darkMode && styles.textDark]}>
            {item.discount_price
              ? formatRupiah(item.discount_price)
              : formatRupiah(item.selling_price)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, darkMode && styles.buttonDark]}
          onPress={() => addToCart(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>+ Tambah</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [darkMode, addToCart, formatRupiah]
  );

  const renderCartItem = useCallback(
    ({ item, index }: { item: CartItem; index: number }) => (
      <View style={[styles.card, darkMode && styles.cardDark]}>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeItem(index)}
        >
          <Text style={styles.buttonText}>X</Text>
        </TouchableOpacity>
        <Text style={[styles.text, darkMode && styles.textDark]}>{item.name}</Text>
        <Text style={[styles.text, darkMode && styles.textDark]}>
          Brand: {item.brand}, Model: {item.model}
        </Text>
        <Text style={[styles.text, darkMode && styles.textDark]}>
          Warna: {item.color}, Ukuran: {item.size}, Kode: {item.unit_code}
        </Text>
        <Text style={[styles.text, darkMode && styles.textDark]}>
          {item.discount_price
            ? formatRupiah(item.discount_price)
            : formatRupiah(item.selling_price)}
        </Text>
      </View>
    ),
    [darkMode, removeItem, formatRupiah]
  );

  const handleCustomerNameChange = useCallback((text: string) => {
    setCustomerName(text);
  }, []);

  const handleCustomerPhoneChange = useCallback((text: string) => {
    setCustomerPhone(text);
  }, []);

  const handleCustomerEmailChange = useCallback((text: string) => {
    setCustomerEmail(text);
  }, []);

  const handleNotesChange = useCallback((text: string) => {
    setNotes(text);
  }, []);

  const handleNewTotalChange = useCallback((text: string) => {
    setNewTotal(text);
    const total = parseFloat(text);
    if (total > calculateSubtotal()) {
      showPopupMessage(
        'Harga Baru Tidak Valid',
        'Harga baru tidak boleh melebihi subtotal.',
        'error'
      );
      setNewTotal(calculateSubtotal().toString());
    } else if (total < 0) {
      showPopupMessage(
        'Harga Baru Tidak Valid',
        'Harga baru tidak boleh kurang dari 0.',
        'error'
      );
      setNewTotal('');
    }
  }, [calculateSubtotal, showPopupMessage]);

  const renderHeader = useCallback(
    () => (
      <View>
        <View style={styles.header}>
          <Text style={[styles.headerText, darkMode && styles.headerTextDark]}>
            BUAT TRANSAKSI BARU
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={() => setDarkMode(!darkMode)}>
              <Text style={styles.modeToggle}>{darkMode ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.buttonText}>← Kembali</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, darkMode && styles.buttonDark]}
              onPress={fetchUnits}
            >
              <Text style={styles.buttonText}>Refresh Data</Text>
            </TouchableOpacity>
          </View>
        </View>

        {errorMessage && (
          <View style={[styles.card, darkMode && styles.cardDark, styles.errorCard]}>
            <Text style={[styles.text, darkMode && styles.textDark]}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={[styles.button, darkMode && styles.buttonDark]}
              onPress={async () => {
                setErrorMessage('');
                await AsyncStorage.removeItem('token');
                navigation.navigate('Login');
              }}
            >
              <Text style={styles.buttonText}>Coba Login Lagi</Text>
            </TouchableOpacity>
          </View>
        )}

        {!permission ? (
          <View style={[styles.card, darkMode && styles.cardDark]}>
            <Text style={[styles.text, darkMode && styles.textDark]}>
              Memuat izin kamera...
            </Text>
          </View>
        ) : !permission.granted ? (
          <View style={[styles.card, darkMode && styles.cardDark]}>
            <Text style={[styles.text, darkMode && styles.textDark]}>
              Kami membutuhkan izin untuk mengakses kamera
            </Text>
            <TouchableOpacity
              style={[styles.button, darkMode && styles.buttonDark]}
              onPress={requestPermission}
            >
              <Text style={styles.buttonText}>Izinkan Kamera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, darkMode && styles.cardDark, styles.productListContainer]}>
            <Text style={[styles.fieldLabel, darkMode && styles.fieldLabelDark]}>
              Pilih Unit Produk
            </Text>
            <TouchableOpacity
              style={[styles.dropdownButton, darkMode && styles.dropdownButtonDark]}
              onPress={() => {
                setShowCamera(true);
                setHasScanned(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.text, darkMode && styles.textDark]}>
                Scan QR Code
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownButton, darkMode && styles.dropdownButtonDark]}
              onPress={() => setShowProductDropdown(!showProductDropdown)}
              activeOpacity={0.7}
            >
              <Text style={[styles.text, darkMode && styles.textDark]}>
                Cari Produk Manual
              </Text>
            </TouchableOpacity>
            <Modal
              visible={showProductDropdown}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowProductDropdown(false)}
            >
              <View style={styles.dropdownModal}>
                <View style={[styles.dropdownContainer, darkMode && styles.dropdownContainerDark]}>
                  <TextInput
                    style={[styles.input, darkMode && styles.inputDark]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Cari nama, brand, model, warna, ukuran, atau kode unit..."
                    placeholderTextColor={darkMode ? '#9CA3AF' : '#9CA3AF'}
                  />
                  <View style={[styles.scrollContainer, darkMode && styles.scrollContainerDark]}>
                    <FlatList
                      data={searchQuery.trim() ? searchResults : availableUnits}
                      renderItem={renderUnit}
                      keyExtractor={(item) => item.unit_code}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                      contentContainerStyle={styles.productListContent}
                      ListEmptyComponent={
                        loading ? null : (
                          <Text style={[styles.text, darkMode && styles.textDark, styles.emptyText]}>
                            {searchQuery.trim()
                              ? 'Tidak ada hasil pencarian.'
                              : 'Tidak ada produk aktif tersedia.'}
                          </Text>
                        )
                      }
                    />
                  </View>
                  {loading && (
                    <View style={[styles.card, darkMode && styles.cardDark]}>
                      <ActivityIndicator
                        size="large"
                        color={darkMode ? '#FFFFFF' : '#3B82F6'}
                      />
                      <Text style={[styles.text, darkMode && styles.textDark]}>
                        Memuat...
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.button, darkMode && styles.buttonDark]}
                    onPress={() => setShowProductDropdown(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.buttonText}>Tutup</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
            <Modal
              visible={showCamera}
              transparent={true}
              animationType="fade"
              onRequestClose={() => {
                setShowCamera(false);
                setHasScanned(false);
              }}
            >
              <View style={styles.cameraContainer}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                  }}
                  onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
                >
                  <View style={styles.cameraOverlay}>
                    <View style={styles.topOverlay} />
                    <View style={styles.middleOverlay}>
                      <View style={styles.leftOverlay} />
                      <View style={styles.scanWindow} />
                      <View style={styles.rightOverlay} />
                    </View>
                    <View style={styles.bottomOverlay} />
                    <View style={styles.cameraInstruction}>
                      <Text style={[styles.text, styles.textDark]}>
                        Arahkan kamera ke kode QR
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cameraButtonContainer}>
                    <TouchableOpacity
                      style={[styles.button, darkMode && styles.buttonDark]}
                      onPress={() => {
                        setShowCamera(false);
                        setHasScanned(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.buttonText}>Tutup Kamera</Text>
                    </TouchableOpacity>
                  </View>
                </CameraView>
              </View>
            </Modal>
          </View>
        )}
      </View>
    ),
    [darkMode, errorMessage, permission, loading, searchQuery, searchResults, availableUnits, showProductDropdown, showCamera, hasScanned, navigation, requestPermission, renderUnit, fetchUnits]
  );

  const { width, height } = Dimensions.get('window');
  const scanWindowSize = Math.min(width, height) * 0.6;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F3F4F6',
      padding: 16,
    },
    containerDark: {
      backgroundColor: '#1F2937',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerText: {
      fontSize: 20,
      fontWeight: '700',
      color: '#1E3A8A',
      textTransform: 'uppercase',
    },
    headerTextDark: {
      color: '#FFFFFF',
    },
    modeToggle: {
      fontSize: 24,
      marginRight: 8,
    },
    backButton: {
      backgroundColor: '#2563EB',
      padding: 8,
      borderRadius: 8,
      marginLeft: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    button: {
      backgroundColor: '#2563EB',
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginVertical: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    buttonDark: {
      backgroundColor: '#1E3A8A',
    },
    removeButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: '#DC2626',
      padding: 4,
      borderRadius: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    card: {
      padding: 16,
      marginVertical: 8,
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
    cardDark: {
      backgroundColor: '#2A3441',
      borderColor: '#93C5FD',
    },
    errorCard: {
      borderColor: '#DC2626',
      borderWidth: 2,
    },
    text: {
      fontSize: 14,
      color: '#1F2937',
    },
    textDark: {
      color: '#FFFFFF',
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#1E3A8A',
      marginBottom: 8,
      marginLeft: 5,
    },
    fieldLabelDark: {
      color: '#FFFFFF',
    },
    input: {
      borderWidth: 1,
      borderColor: '#93C5FD',
      padding: 8,
      marginVertical: 8,
      borderRadius: 8,
      backgroundColor: '#1F2937',
      color: '#FFFFFF',
    },
    inputDark: {
      borderColor: '#93C5FD',
      backgroundColor: '#2A3441',
    },
    modal: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    productListContainer: {
      paddingBottom: 16,
    },
    dropdownButton: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: '#2563EB',
      marginVertical: 8,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    dropdownButtonDark: {
      backgroundColor: '#1E3A8A',
    },
    dropdownModal: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    dropdownContainer: {
      margin: 20,
      padding: 16,
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      maxHeight: '80%',
      width: '90%',
      alignSelf: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    dropdownContainerDark: {
      backgroundColor: '#2A3441',
      borderColor: '#93C5FD',
    },
    scrollContainer: {
      borderWidth: 1,
      borderColor: '#BFDBFE',
      borderRadius: 8,
      backgroundColor: '#FFFFFF',
      marginVertical: 8,
      maxHeight: '60%',
    },
    scrollContainerDark: {
      borderColor: '#93C5FD',
      backgroundColor: '#2A3441',
    },
    productListContent: {
      padding: 8,
    },
    productCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      marginVertical: 4,
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
    productCardDark: {
      backgroundColor: '#2A3441',
      borderColor: '#93C5FD',
    },
    productCardContent: {
      flex: 1,
      marginRight: 8,
    },
    productName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1F2937',
      marginBottom: 4,
    },
    productDetails: {
      fontSize: 14,
      color: '#1F2937',
      marginBottom: 4,
    },
    productStock: {
      fontSize: 14,
      color: '#1F2937',
      marginBottom: 4,
    },
    productPrice: {
      fontSize: 14,
      fontWeight: '600',
      color: '#1E3A8A',
    },
    addButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: '#2563EB',
      borderRadius: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    emptyText: {
      textAlign: 'center',
      padding: 16,
      color: '#9CA3AF',
    },
    cameraContainer: {
      flex: 1,
      backgroundColor: 'black',
    },
    camera: {
      flex: 1,
    },
    cameraOverlay: {
      ...StyleSheet.absoluteFillObject,
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      width: '100%',
    },
    middleOverlay: {
      flexDirection: 'row',
      width: '100%',
      height: scanWindowSize,
    },
    leftOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    scanWindow: {
      width: scanWindowSize,
      height: scanWindowSize,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      backgroundColor: 'transparent',
    },
    rightOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    bottomOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      width: '100%',
    },
    cameraInstruction: {
      position: 'absolute',
      top: 20,
      alignItems: 'center',
      width: '100%',
    },
    cameraButtonContainer: {
      position: 'absolute',
      bottom: 40,
      width: '100%',
      alignItems: 'center',
    },
  });

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.containerDark]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
      >
        <FlatList
          data={[]}
          renderItem={() => null}
          keyExtractor={(_, index) => index.toString()}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={
            <View>
              <View style={[styles.card, darkMode && styles.cardDark]}>
                <Text style={[styles.fieldLabel, darkMode && styles.fieldLabelDark]}>
                  Informasi Pelanggan
                </Text>
                <TextInput
                  style={[styles.input, darkMode && styles.inputDark]}
                  value={customerName}
                  onChangeText={handleCustomerNameChange}
                  placeholder="Nama Pelanggan"
                  placeholderTextColor={darkMode ? '#9CA3AF' : '#9CA3AF'}
                />
                <TextInput
                  style={[styles.input, darkMode && styles.inputDark]}
                  value={customerPhone}
                  onChangeText={handleCustomerPhoneChange}
                  placeholder="No. Telepon"
                  placeholderTextColor={darkMode ? '#9CA3AF' : '#9CA3AF'}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={[styles.input, darkMode && styles.inputDark]}
                  value={customerEmail}
                  onChangeText={handleCustomerEmailChange}
                  placeholder="Email Pelanggan"
                  placeholderTextColor={darkMode ? '#9CA3AF' : '#9CA3AF'}
                  keyboardType="email-address"
                />
                <Picker
                  selectedValue={paymentMethod}
                  onValueChange={(value) => {
                    setPaymentMethod(value);
                    if (value !== 'debit') setCardType('');
                  }}
                  style={[styles.input, darkMode && styles.inputDark]}
                  dropdownIconColor={darkMode ? '#FFFFFF' : '#FFFFFF'}
                >
                  <Picker.Item label="Pilih metode pembayaran" value="" />
                  <Picker.Item label="Tunai" value="cash" />
                  <Picker.Item label="QRIS" value="qris" />
                  <Picker.Item label="Debit" value="debit" />
                  <Picker.Item label="Transfer Bank" value="transfer" />
                </Picker>
                {paymentMethod === 'debit' && (
                  <Picker
                    selectedValue={cardType}
                    onValueChange={setCardType}
                    style={[styles.input, darkMode && styles.inputDark]}
                    dropdownIconColor={darkMode ? '#FFFFFF' : '#FFFFFF'}
                  >
                    <Picker.Item label="Pilih tipe kartu" value="" />
                    <Picker.Item label="Mandiri" value="Mandiri" />
                    <Picker.Item label="BRI" value="BRI" />
                    <Picker.Item label="BCA" value="BCA" />
                  </Picker>
                )}
                <TextInput
                  style={[styles.input, darkMode && styles.inputDark, { height: 100 }]}
                  value={notes}
                  onChangeText={handleNotesChange}
                  placeholder="Catatan"
                  placeholderTextColor={darkMode ? '#9CA3AF' : '#9CA3AF'}
                  multiline
                />
              </View>

              <View style={[styles.card, darkMode && styles.cardDark]}>
                <Text style={[styles.fieldLabel, darkMode && styles.fieldLabelDark]}>
                  Keranjang Belanja
                </Text>
                {cart.length === 0 ? (
                  <View style={[styles.card, darkMode && styles.cardDark]}>
                    <Text style={[styles.text, darkMode && styles.textDark]}>
                      Keranjang Kosong
                    </Text>
                    <Text style={[styles.text, darkMode && styles.textDark]}>
                      Tambahkan unit produk dari daftar
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={cart}
                    renderItem={renderCartItem}
                    keyExtractor={(_, index) => index.toString()}
                    style={{ maxHeight: 200 }}
                  />
                )}
                <View style={{ marginTop: 16 }}>
                  <Text style={[styles.text, darkMode && styles.textDark]}>
                    Subtotal: {formatRupiah(calculateSubtotal())}
                  </Text>
                  <Text style={[styles.text, darkMode && styles.textDark]}>
                    Diskon: {formatRupiah(calculateDiscount())}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.text, darkMode && styles.textDark]}>
                      Harga Baru:{' '}
                    </Text>
                    <TextInput
                      style={[styles.input, darkMode && styles.inputDark, { flex: 1 }]}
                      value={newTotal}
                      onChangeText={handleNewTotalChange}
                      placeholder="Masukkan harga baru"
                      placeholderTextColor={darkMode ? '#9CA3AF' : '#9CA3AF'}
                      keyboardType="numeric"
                    />
                  </View>
                  <Text
                    style={[styles.text, darkMode && styles.textDark, { fontWeight: '600' }]}
                  >
                    Total Bayar: {formatRupiah(calculateTotal())}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      darkMode && styles.buttonDark,
                      { opacity: cart.length === 0 || loading ? 0.5 : 1 },
                    ]}
                    onPress={submitTransaction}
                    disabled={cart.length === 0 || loading}
                  >
                    <Text style={styles.buttonText}>
                      {loading ? 'Memproses...' : 'Proses Transaksi'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ height: 20 }} />
            </View>
          }
          ListFooterComponentStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        />
      </KeyboardAvoidingView>
      <Modal visible={showPopup} transparent animationType="fade">
        <View style={styles.modal}>
          <View style={[styles.card, darkMode && styles.cardDark, popupType === 'error' && styles.errorCard]}>
            <Text
              style={[styles.text, darkMode && styles.textDark, { fontWeight: '600', color: popupType === 'error' ? '#DC2626' : '#1E3A8A' }]}
            >
              {popupTitle}
            </Text>
            <Text style={[styles.text, darkMode && styles.textDark]}>
              {popupMessage}
            </Text>
            <TouchableOpacity
              style={[styles.button, darkMode && styles.buttonDark]}
              onPress={() => setShowPopup(false)}
            >
              <Text style={styles.buttonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default TransactionCreate;