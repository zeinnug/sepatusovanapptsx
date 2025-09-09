import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';

// Navigation param list
type RootStackParamList = {
  TransactionIndex: { showPrint?: boolean };
  TransactionCreate: undefined;
};

// Navigation prop type
type TransactionIndexNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'TransactionIndex'
>;

// Interfaces for API data
interface TransactionItem {
  id: number;
  product_id: number;
  product_name: string;
  product_unit_id: number;
  unit_code: string;
  color: string | null;
  size: string | null;
  quantity: number;
  price: number;
  discount: number;
  subtotal: number;
}

interface Transaction {
  id: number;
  invoice_number: string;
  user_id: number;
  user_name: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  payment_method: string;
  card_type: string | null;
  payment_status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
  created_at: string;
  items: TransactionItem[];
}

interface ApiResponse {
  success: boolean;
  data: {
    transactions: Transaction[];
  };
  message?: string;
}

interface Props {
  navigation: TransactionIndexNavigationProp;
}

const TransactionIndex: React.FC<Props> = ({ navigation }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [printing, setPrinting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('Semua Metode');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('Semua Status');
  const [selectedPrinter, setSelectedPrinter] = useState<
    { name: string; url: string } | undefined
  >();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showPrintPopup, setShowPrintPopup] = useState<boolean>(false);
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'TransactionIndex'>['route']>();

  const paymentMethods = ['Semua Metode', 'cash', 'qris', 'Transfer Bank'];
  const paymentStatuses = ['Semua Status', 'paid', 'unpaid'];
  const WIB_OFFSET = 7 * 60 * 60 * 1000; // UTC+7 in milliseconds
  const API_URL = 'https://testingaplikasi.tokosepatusovan.com/api/transactions';

  // Update waktu real-time setiap menit (sesuai Dashboard)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Perbarui setiap menit
    return () => clearInterval(timer);
  }, []);

  // Check for navigation params to show print popup
  useEffect(() => {
    if (route.params?.showPrint && transactions.length > 0) {
      setShowPrintPopup(true);
    }
  }, [route.params, transactions]);

  // Format date to YYYY-MM-DD in WIB
  const formatDateWIB = (date: Date): string => {
    const wibDate = new Date(date.getTime() + WIB_OFFSET);
    return `${wibDate.getUTCFullYear()}-${(wibDate.getUTCMonth() + 1)
      .toString()
      .padStart(2, '0')}-${wibDate.getUTCDate().toString().padStart(2, '0')}`;
  };

  // Format date and time for display (dd MMMM yyyy HH:mm)
  const formatDisplayDate = (date: Date): string => {
    const wibDate = new Date(date.getTime() + WIB_OFFSET);
    return wibDate.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format invoice number (INV-DDMMYYYY)
  const formatInvoiceNumber = (date: string): string => {
    const wibDate = new Date(new Date(date).getTime() + WIB_OFFSET);
    const day = wibDate.getUTCDate().toString().padStart(2, '0');
    const month = (wibDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = wibDate.getUTCFullYear().toString();
    return `INV-${day}${month}${year}`;
  };

  // Fetch transactions
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const params = new URLSearchParams();
      params.append('date', formatDateWIB(filterDate));
      params.append('no_cache', 'true'); // Nonaktifkan cache untuk data fresh
      if (filterPaymentMethod !== 'Semua Metode') {
        params.append('payment_method', filterPaymentMethod);
      }
      if (filterPaymentStatus !== 'Semua Status') {
        params.append('payment_status', filterPaymentStatus);
      }

      const url = `${API_URL}?${params.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse = await response.json();

      if (result.success) {
        const formattedTransactions = result.data.transactions.map(transaction => ({
          ...transaction,
          invoice_number: formatInvoiceNumber(transaction.created_at),
        }));
        setTransactions(formattedTransactions);
      } else {
        throw new Error(result.message || 'Failed to fetch transactions');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Error fetching transactions: ${errorMessage}`);
      Alert.alert('Error', `Error fetching transactions: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [filterDate, filterPaymentMethod, filterPaymentStatus])
  );

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const wibDate = new Date(selectedDate.getTime() + WIB_OFFSET);
      wibDate.setUTCHours(0, 0, 0, 0);
      setFilterDate(new Date(wibDate.getTime() - WIB_OFFSET));
    }
  };

  const printReceipt = async (transaction: Transaction) => {
    try {
      setPrinting(true);
      if (Platform.OS === 'ios' && !selectedPrinter) {
        Alert.alert('Error', 'Please select a printer first.');
        return;
      }

      const totalQuantity = transaction.items.reduce((sum, item) => sum + item.quantity, 0);

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=576, initial-scale=1.0" />
            <style>
              body { width: 576px; margin: 0; padding: 8px; font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 1.2; color: #000; text-align: center; }
              h1 { font-size: 14px; font-weight: bold; margin: 4px 0; }
              .line { border-top: 1px dashed #000; margin: 4px 0; }
              .item { text-align: left; margin: 2px 0; font-size: 11px; }
              .total { font-weight: bold; font-size: 12px; margin-top: 8px; }
              .row { display: flex; justify-content: space-between; margin: 2px 0; }
              .label { font-weight: bold; }
              p { margin: 2px 0; }
            </style>
          </head>
          <body>
            <h1>Sepatu by Sovan</h1>
            <p>Jl. Puri Anjasmoro B10/9 Smg</p>
            <p>0818671005</p>
            <div class="line"></div>
            <div class="row">
              <span class="label">Invoice:</span>
              <span>${formatInvoiceNumber(transaction.created_at)}</span>
            </div>
            <div class="row">
              <span class="label">Date:</span>
              <span>${formatDisplayDate(new Date(transaction.created_at))}</span>
            </div>
            <div class="row">
              <span class="label">Cashier:</span>
              <span>${transaction.user_name}</span>
            </div>
            <div class="row">
              <span class="label">Customer:</span>
              <span>${transaction.customer_name}</span>
            </div>
            <div class="row">
              <span class="label">Phone:</span>
              <span>${transaction.customer_phone}</span>
            </div>
            <div class="line"></div>
            ${transaction.items
              .map(
                (item) =>
                  `<div class="item">${item.product_name} (UNIT-${item.unit_code})${
                    item.size ? `, Size: ${item.size}` : ''
                  }${item.color ? `, Color: ${item.color}` : ''}<br>${
                    item.quantity
                  } x Rp ${item.price.toLocaleString('id-ID')} = Rp ${item.subtotal.toLocaleString(
                    'id-ID'
                  )}</div>`
              )
              .join('')}
            <div class="line"></div>
            <div class="row">
              <span class="label">Total Quantity:</span>
              <span>${totalQuantity}</span>
            </div>
            <div class="row">
              <span class="label">Subtotal:</span>
              <span>Rp ${transaction.total_amount.toLocaleString('id-ID')}</span>
            </div>
            <div class="row">
              <span class="label">Discount:</span>
              <span>Rp ${transaction.discount_amount.toLocaleString('id-ID')}</span>
            </div>
            <div class="row">
              <span class="label">Tax:</span>
              <span>Rp ${transaction.tax_amount.toLocaleString('id-ID')}</span>
            </div>
            <div class="row total">
              <span class="label">Total:</span>
              <span>Rp ${transaction.final_amount.toLocaleString('id-ID')}</span>
            </div>
            <div class="row">
              <span class="label">Payment:</span>
              <span>${transaction.payment_method}${
                transaction.card_type ? ` (${transaction.card_type})` : ''
              }</span>
            </div>
            <div class="line"></div>
            <p>Thank you for your purchase!</p>
            <p>Barang Tidak Sesuai Dapat Ditukarkan, Asalkan Belum Dipakai.</p>
            <p>Gabung grup Whatsapp kami untuk info diskon dan penawaran menarik!</p>
            <p>https://chat.whatsapp.com/CSk1pDf9g2STaQk2a5e?</p>
          </body>
        </html>
      `;

      await Print.printAsync({
        html,
        printerUrl: Platform.OS === 'ios' ? selectedPrinter?.url : undefined,
        width: 576,
      });
      Alert.alert('Success', 'Receipt printed successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to print receipt: ${errorMessage}`);
    } finally {
      setPrinting(false);
    }
  };

  const selectPrinter = async () => {
    if (Platform.OS === 'ios') {
      try {
        const printer = await Print.selectPrinterAsync();
        if (printer) {
          setSelectedPrinter(printer);
          Alert.alert('Success', `Printer selected: ${printer.name}`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('Error', `Failed to select printer: ${errorMessage}`);
      }
    }
  };

  const resetFilters = () => {
    setFilterDate(new Date());
    setFilterPaymentMethod('Semua Metode');
    setFilterPaymentStatus('Semua Status');
  };

  const handlePrintNewTransaction = () => {
    if (transactions.length > 0) {
      printReceipt(transactions[0]); // Print transaksi terbaru
    }
    setShowPrintPopup(false);
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionCardGradient}>
        <Text style={styles.invoiceText}>{formatInvoiceNumber(item.created_at)}</Text>
        <Text style={styles.customerText}>Customer: {item.customer_name}</Text>
        <Text style={styles.amountText}>
          Total: Rp {item.final_amount.toLocaleString('id-ID')}
        </Text>
        <Text style={styles.paymentText}>Payment: {item.payment_method}</Text>
        <Text style={styles.dateText}>
          Date: {formatDisplayDate(new Date(item.created_at))}
        </Text>
        <View style={styles.itemsContainer}>
          <Text style={styles.itemsTitle}>Items:</Text>
          {item.items.map((product: TransactionItem) => (
            <Text key={product.id} style={styles.itemText}>
              {product.product_name} (Qty: {product.quantity}, Rp{' '}
              {product.subtotal.toLocaleString('id-ID')})
            </Text>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.printButton, printing && styles.printButtonDisabled]}
          onPress={() => printReceipt(item)}
          disabled={printing}
        >
          <Text style={styles.printButtonText}>
            {printing ? 'Printing...' : 'Cetak Struk'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Memuat Transaksi...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            setError(null);
            fetchTransactions();
          }}
        >
          <Text style={styles.buttonText}>Coba Lagi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>@SEPATUBYSOVAN</Text>
        <Text style={styles.subtitle}>
          Waktu Saat Ini: {formatDisplayDate(currentTime)}
        </Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>SISTEM KASIR</Text>
          <Text style={styles.buttonSubText}>Daftar Transaksi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('TransactionCreate')}
        >
          <Text style={styles.actionButtonText}>+ TRANSAKSI BARU</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Laporan Penjualan</Text>
        </TouchableOpacity>
      </View>

      {Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.selectPrinterButton} onPress={selectPrinter}>
          <Text style={styles.selectPrinterButtonText}>
            {selectedPrinter ? `Printer: ${selectedPrinter.name}` : 'Pilih Printer'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.filterContainer}>
        <Text style={styles.filterTitle}>Filter Transaksi</Text>
        <View style={styles.filterRow}>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Tanggal</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={styles.filterInput}
            >
              <Text style={styles.dateTextInput}>{formatDisplayDate(filterDate)}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={filterDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={onDateChange}
                style={styles.datePicker}
                textColor="#FFFFFF"
              />
            )}
          </View>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Metode Pembayaran</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filterPaymentMethod}
                onValueChange={(itemValue) => setFilterPaymentMethod(itemValue)}
                style={styles.picker}
                dropdownIconColor="#FFFFFF"
              >
                {paymentMethods.map((method) => (
                  <Picker.Item key={method} label={method} value={method} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Status Pembayaran</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filterPaymentStatus}
                onValueChange={(itemValue) => setFilterPaymentStatus(itemValue)}
                style={styles.picker}
                dropdownIconColor="#FFFFFF"
              >
                {paymentStatuses.map((status) => (
                  <Picker.Item key={status} label={status} value={status} />
                ))}
              </Picker>
            </View>
          </View>
          <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
            <Text style={styles.resetButtonText}>Reset Filter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.noTransactions}>
          <Text style={styles.noTransactionsText}>TIDAK ADA TRANSAKSI</Text>
          <Text style={styles.noTransactionsSubText}>
            Belum ada transaksi untuk filter yang dipilih.
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
        />
      )}

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => navigation.navigate('TransactionCreate')}
      >
        <Text style={styles.createButtonText}>+ BUAT TRANSAKSI BARU</Text>
      </TouchableOpacity>

      <Modal
        visible={showPrintPopup}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPrintPopup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.printPopupContainer}>
            <Text style={styles.printPopupTitle}>Transaksi Berhasil!</Text>
            <Text style={styles.printPopupMessage}>
              Transaksi baru telah dibuat. Apakah Anda ingin mencetak struk sekarang?
            </Text>
            <View style={styles.printPopupButtons}>
              <TouchableOpacity
                style={[styles.printPopupButton, styles.cancelButton]}
                onPress={() => setShowPrintPopup(false)}
              >
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.printPopupButton, styles.modalPrintButton]}
                onPress={handlePrintNewTransaction}
                disabled={printing}
              >
                <Text style={styles.printButtonText}>
                  {printing ? 'Mencetak...' : 'Cetak Struk'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 16,
    width: '100%',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#1E3A8A',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'serif',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  subtitle: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93C5FD',
    flex: 1,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButton: {
    backgroundColor: '#2563EB',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonSubText: {
    color: '#1F2937',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  filterTitle: {
    color: '#1E3A8A',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  filterItem: {
    flex: 1,
    marginRight: 8,
    minWidth: 100,
  },
  filterLabel: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  filterInput: {
    backgroundColor: '#1F2937',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93C5FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateTextInput: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  pickerContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  picker: {
    color: '#FFFFFF',
    height: 40,
  },
  resetButton: {
    backgroundColor: '#2563EB',
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  noTransactions: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noTransactionsText: {
    color: '#1E3A8A',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  noTransactionsSubText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  transactionCard: {
    marginBottom: 16,
  },
  transactionCardGradient: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  invoiceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 8,
  },
  customerText: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 4,
  },
  amountText: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 4,
    fontWeight: '600',
  },
  paymentText: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 8,
  },
  itemsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
    paddingTop: 8,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  itemText: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 4,
  },
  printButton: {
    backgroundColor: '#2563EB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  printButtonDisabled: {
    backgroundColor: '#2563EB80',
  },
  printButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  selectPrinterButton: {
    backgroundColor: '#2563EB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  selectPrinterButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    color: '#1E3A8A',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 28,
  },
  retryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  datePicker: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93C5FD',
    marginTop: 4,
  },
  listContainer: {
    paddingBottom: 80,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  printPopupContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  printPopupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginBottom: 8,
    textAlign: 'center',
  },
  printPopupMessage: {
    fontSize: 16,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  printPopupButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  printPopupButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#9CA3AF',
  },
  modalPrintButton: {
    backgroundColor: '#2563EB',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TransactionIndex;