import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Define navigation param list
type RootStackParamList = {
  TransactionIndex: undefined;
  TransactionCreate: undefined;
};

// Define navigation prop type
type TransactionIndexNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TransactionIndex'>;

// Define interfaces for API data
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
  const [error, setError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<Date>(new Date()); // Current date: August 10, 2025
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('Semua Metode');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('Semua Status');

  const paymentMethods = ['Semua Metode', 'cash', 'qris'];
  const paymentStatuses = ['Semua Status', 'paid', 'unpaid'];

  const fetchTransactions = async () => {
    try {
      console.log('Attempting to retrieve token from AsyncStorage...');
      const token = await AsyncStorage.getItem('token');
      console.log('Retrieved token:', token ? 'Token found' : 'No token found');

      if (!token) {
        setError('No authentication token found. Please log in again.');
        setLoading(false);
        return;
      }

      // Format date in WIB (UTC+7) as YYYY-MM-DD
      const wibOffset = 7 * 60; // WIB is UTC+7 (7 hours in minutes)
      const filterDateWIB = new Date(filterDate.getTime() + wibOffset * 60 * 1000);
      const formattedDate = filterDateWIB.toISOString().split('T')[0]; // YYYY-MM-DD
      console.log('Formatted filter date (WIB):', formattedDate);

      const params = new URLSearchParams();
      if (formattedDate !== new Date().toISOString().split('T')[0]) {
        params.append('date', formattedDate);
      }
      if (filterPaymentMethod !== 'Semua Metode') {
        params.append('payment_method', filterPaymentMethod);
      }
      if (filterPaymentStatus !== 'Semua Status') {
        params.append('payment_status', filterPaymentStatus);
      }

      console.log('Fetching transactions from API with URL:', `http://192.168.1.6:8000/api/transactions?${params.toString()}`);
      const response = await fetch(`http://192.168.1.6:8000/api/transactions?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('API response status:', response.status);
      const result: ApiResponse = await response.json();
      console.log('API response data:', JSON.stringify(result.data.transactions, null, 2));

      if (result.success) {
        // Check if API returned no transactions
        if (result.data.transactions.length === 0) {
          console.log('No transactions returned from API');
          setTransactions([]);
        } else {
          // Client-side filtering by local date (WIB)
          const localFilterDate = new Date(filterDate);
          localFilterDate.setHours(0, 0, 0, 0); // Reset time to midnight
          const filteredTransactions = result.data.transactions.filter((transaction) => {
            // Convert server UTC date to WIB
            const transactionDate = new Date(transaction.created_at);
            const transactionDateWIB = new Date(transactionDate.getTime() + wibOffset * 60 * 1000);
            transactionDateWIB.setHours(0, 0, 0, 0); // Reset time to midnight
            const transactionLocalDate = transactionDateWIB.toLocaleDateString('en-CA'); // YYYY-MM-DD
            const localFilterDateStr = localFilterDate.toLocaleDateString('en-CA');
            console.log(
              `Comparing local filter date ${localFilterDateStr} with transaction date ${transactionLocalDate} for ${transaction.invoice_number}`
            );
            return transactionLocalDate === localFilterDateStr;
          });
          console.log('Filtered transactions:', JSON.stringify(filteredTransactions, null, 2));
          setTransactions(filteredTransactions);
        }
      } else {
        setError('Failed to fetch transactions: ' + (result.message || 'Unknown error'));
      }
    } catch (err: unknown) {
      console.error('Error fetching transactions:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Error fetching transactions: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [filterDate, filterPaymentMethod, filterPaymentStatus]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || filterDate;
    setShowDatePicker(false);
    setFilterDate(currentDate);
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionCard}>
      <Text style={styles.invoiceText}>{item.invoice_number}</Text>
      <Text style={styles.customerText}>Customer: {item.customer_name}</Text>
      <Text style={styles.amountText}>Total: Rp {item.final_amount.toLocaleString()}</Text>
      <Text style={styles.paymentText}>Payment: {item.payment_method}</Text>
      <Text style={styles.dateText}>
        Date: {new Date(item.created_at).toLocaleDateString()}
      </Text>
      <View style={styles.itemsContainer}>
        <Text style={styles.itemsTitle}>Items:</Text>
        {item.items.map((product: TransactionItem) => (
          <Text key={product.id} style={styles.itemText}>
            {product.product_name} (Qty: {product.quantity}, Rp {product.subtotal.toLocaleString()})
          </Text>
        ))}
      </View>
    </View>
  );

  const resetFilters = () => {
    setFilterDate(new Date());
    setFilterPaymentMethod('Semua Metode');
    setFilterPaymentStatus('Semua Status');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FFAA" />
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
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SEPATU BY SOVAN</Text>
      <Text style={styles.subtitle}>Luxury Footwear Collection</Text>
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

      <View style={styles.filterContainer}>
        <Text style={styles.filterTitle}>Filter Transaksi</Text>
        <View style={styles.filterRow}>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Tanggal</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.filterInput}>
              <Text style={styles.dateTextInput}>{filterDate.toLocaleDateString('en-GB')}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={filterDate}
                mode="date"
                display="default"
                onChange={onDateChange}
                style={styles.datePicker}
                textColor="#FFD700"
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
                dropdownIconColor="#FFD700"
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
                dropdownIconColor="#FFD700"
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
          <Text style={styles.noTransactionsSubText}>Belum ada transaksi untuk filter yang dipilih.</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E2A3A',
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00FFAA',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD700',
    flex: 1,
    marginRight: 5,
  },
  actionButton: {
    backgroundColor: '#00FFAA',
    padding: 10,
    borderRadius: 10,
    flex: 1,
    marginLeft: 5,
  },
  buttonText: {
    color: '#FFD700',
    fontSize: 16,
    textAlign: 'center',
  },
  buttonSubText: {
    color: '#FFD700',
    fontSize: 12,
    textAlign: 'center',
  },
  actionButtonText: {
    color: '#1E2A3A',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  filterContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  filterTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterItem: {
    flex: 1,
    marginRight: 10,
  },
  filterLabel: {
    color: '#FFD700',
    fontSize: 14,
    marginBottom: 5,
  },
  filterInput: {
    backgroundColor: '#2A3441',
    padding: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateTextInput: {
    color: '#FFD700',
    fontSize: 14,
    textAlign: 'center',
  },
  pickerContainer: {
    backgroundColor: '#2A3441',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  picker: {
    color: '#FFD700',
    height: 30,
  },
  resetButton: {
    backgroundColor: '#00FFAA',
    padding: 10,
    borderRadius: 10,
    justifyContent: 'center',
  },
  resetButtonText: {
    color: '#1E2A3A',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noTransactions: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noTransactionsText: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  noTransactionsSubText: {
    color: '#FFD700',
    fontSize: 14,
    textAlign: 'center',
  },
  transactionCard: {
    backgroundColor: '#2A3441',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  invoiceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00FFAA',
    marginBottom: 5,
  },
  customerText: {
    fontSize: 16,
    color: '#FFD700',
    marginBottom: 5,
  },
  amountText: {
    fontSize: 16,
    color: '#FFD700',
    marginBottom: 5,
  },
  paymentText: {
    fontSize: 14,
    color: '#FFD700',
    marginBottom: 5,
  },
  dateText: {
    fontSize: 14,
    color: '#FFD700',
    marginBottom: 10,
  },
  itemsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#FFD700',
    paddingTop: 10,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 5,
  },
  itemText: {
    fontSize: 14,
    color: '#FFD700',
    marginBottom: 5,
  },
  createButton: {
    backgroundColor: '#00FFAA',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#1E2A3A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#00FFAA',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#1E2A3A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  datePicker: {
    backgroundColor: '#2A3441',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  listContainer: {
    paddingBottom: 20,
  },
});

export default TransactionIndex;