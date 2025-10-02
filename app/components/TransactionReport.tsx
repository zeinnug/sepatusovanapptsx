import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

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

const TransactionReport = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter states
  const [reportType, setReportType] = useState('harian');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentType, setPaymentType] = useState('');

  const WIB_OFFSET = 7 * 60 * 60 * 1000;
  const API_URL = 'https://testingaplikasi.tokosepatusovan.com/api/transactions';

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [transactions, reportType, selectedDate, paymentType, searchQuery]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setTransactions(result.data.transactions);
        setFilteredTransactions(result.data.transactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTransactions = () => {
    let filtered = [...transactions];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.items?.some(item => item.product_name?.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by payment type
    if (paymentType) {
      filtered = filtered.filter(t => t.payment_method?.toLowerCase() === paymentType.toLowerCase());
    }

    // Filter by date and report type
    if (selectedDate) {
      const selected = new Date(selectedDate);
      filtered = filtered.filter(t => {
        const transactionDate = new Date(t.created_at);
        
        if (reportType === 'harian') {
          return transactionDate.toDateString() === selected.toDateString();
        } else if (reportType === 'mingguan') {
          const weekStart = new Date(selected);
          weekStart.setDate(selected.getDate() - selected.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          return transactionDate >= weekStart && transactionDate <= weekEnd;
        } else if (reportType === 'bulanan') {
          return transactionDate.getMonth() === selected.getMonth() && 
                 transactionDate.getFullYear() === selected.getFullYear();
        } else if (reportType === 'tahunan') {
          return transactionDate.getFullYear() === selected.getFullYear();
        }
        return true;
      });
    }

    setFilteredTransactions(filtered);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatInvoiceNumber = (date: string): string => {
    const wibDate = new Date(new Date(date).getTime() + WIB_OFFSET);
    const day = wibDate.getUTCDate().toString().padStart(2, '0');
    const month = (wibDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = wibDate.getUTCFullYear().toString();
    return `INV-${day}${month}${year}`;
  };

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  };

  const goToPreviousDate = () => {
    const newDate = new Date(selectedDate);
    if (reportType === 'harian') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (reportType === 'mingguan') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (reportType === 'bulanan') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (reportType === 'tahunan') {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setSelectedDate(newDate);
  };

  const goToNextDate = () => {
    const newDate = new Date(selectedDate);
    const today = new Date();
    
    if (reportType === 'harian') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (reportType === 'mingguan') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (reportType === 'bulanan') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (reportType === 'tahunan') {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    
    // Don't go beyond today
    if (newDate <= today) {
      setSelectedDate(newDate);
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const getDateRangeText = () => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    if (reportType === 'harian') {
      return selectedDate.toLocaleDateString('id-ID', options);
    } else if (reportType === 'mingguan') {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${weekStart.toLocaleDateString('id-ID', options)} - ${weekEnd.toLocaleDateString('id-ID', options)}`;
    } else if (reportType === 'bulanan') {
      return selectedDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
    } else if (reportType === 'tahunan') {
      return selectedDate.getFullYear().toString();
    }
    return '';
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Laporan Transaksi</Text>
      </View>

      {/* Rentang Waktu Section */}
      <View style={styles.filterCard}>
        <Text style={styles.filterTitle}>Rentang waktu</Text>
        
        <View style={styles.filterRow}>
          {/* Tipe Laporan */}
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Tipe Laporan</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={reportType}
                onValueChange={(itemValue) => setReportType(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Harian" value="harian" />
                <Picker.Item label="Mingguan" value="mingguan" />
                <Picker.Item label="Bulanan" value="bulanan" />
                <Picker.Item label="Tahunan" value="tahunan" />
              </Picker>
            </View>
          </View>

          {/* Tanggal */}
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Tanggal</Text>
            
            {/* Date Navigation Buttons */}
            <View style={styles.dateNavigationContainer}>
              <TouchableOpacity
                onPress={goToPreviousDate}
                style={styles.dateNavButton}
              >
                <Text style={styles.dateNavButtonText}>◀</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={styles.dateButtonExpanded}
              >
                <Text style={styles.dateButtonText}>
                  {getDateRangeText()}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={goToNextDate}
                style={styles.dateNavButton}
              >
                <Text style={styles.dateNavButtonText}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Today Button */}
            <TouchableOpacity
              onPress={goToToday}
              style={styles.todayButton}
            >
              <Text style={styles.todayButtonText}>Hari Ini</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={onDateChange}
                minimumDate={new Date(2025, 0, 1)}
                maximumDate={new Date(2025, 11, 31)}
              />
            )}
          </View>

          {/* Jenis Pembayaran */}
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Jenis Pembayaran</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={paymentType}
                onValueChange={(itemValue) => setPaymentType(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Semua Pembayaran" value="" />
                <Picker.Item label="Cash" value="cash" />
                <Picker.Item label="QRIS" value="qris" />
                <Picker.Item label="Transfer" value="Transfer Bank" />
              </Picker>
            </View>
          </View>

          {/* Search */}
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Cari Transaksi</Text>
            <TextInput
              placeholder="Cari invoice, customer, produk..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              placeholderTextColor="#585757"
            />
          </View>
        </View>
      </View>

      {/* Laporan Section */}
      <View style={styles.reportCard}>
        <View style={styles.reportHeader}>
          <Text style={styles.reportTitle}>Laporan</Text>
        </View>

        {/* Table */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FC6A0A" />
            <Text style={styles.loadingText}>Memuat data...</Text>
          </View>
        ) : filteredTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Tidak ada data transaksi</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colNo]}>NO</Text>
                <Text style={[styles.tableHeaderCell, styles.colInvoice]}>No pesanan</Text>
                <Text style={[styles.tableHeaderCell, styles.colDate]}>Tanggal pesanan</Text>
                <Text style={[styles.tableHeaderCell, styles.colProduct]}>Nama Produk</Text>
                <Text style={[styles.tableHeaderCell, styles.colPrice]}>Harga</Text>
                <Text style={[styles.tableHeaderCell, styles.colPayment]}>Jenis pembayaran</Text>
              </View>

              {/* Table Body */}
              {filteredTransactions.map((transaction, index) => (
                <View 
                  key={transaction.id}
                  style={[
                    styles.tableRow,
                    index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd
                  ]}
                >
                  <Text style={[styles.tableCell, styles.colNo]}>{index + 1}</Text>
                  <Text style={[styles.tableCell, styles.colInvoice]}>
                    {formatInvoiceNumber(transaction.created_at)}
                  </Text>
                  <Text style={[styles.tableCell, styles.colDate]}>
                    {formatDate(transaction.created_at)}
                  </Text>
                  <View style={[styles.tableCell, styles.colProduct]}>
                    {transaction.items.map((item, idx) => (
                      <Text key={idx} style={styles.productText}>
                        {item.product_name}
                        {item.size ? ` (${item.size})` : ''}
                        {item.color ? ` - ${item.color}` : ''}
                      </Text>
                    ))}
                  </View>
                  <Text style={[styles.tableCell, styles.colPrice, styles.priceText]}>
                    {formatCurrency(transaction.final_amount)}
                  </Text>
                  <View style={[styles.tableCell, styles.colPayment]}>
                    <View style={[
                      styles.paymentBadge,
                      transaction.payment_method.toLowerCase() === 'cash' && styles.paymentCash,
                      transaction.payment_method.toLowerCase() === 'qris' && styles.paymentQris,
                      transaction.payment_method.toLowerCase().includes('transfer') && styles.paymentTransfer,
                    ]}>
                      <Text style={styles.paymentBadgeText}>
                        {transaction.payment_method.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5ECE4',
  },
  header: {
    backgroundColor: '#292929',
    padding: 20,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  headerTitle: {
    color: '#FC6A0A',
    fontSize: 24,
    fontWeight: 'bold',
  },
  filterCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#292929',
    marginBottom: 16,
  },
  filterRow: {
    gap: 12,
  },
  filterItem: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#292929',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 2,
    borderColor: '#585757',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  picker: {
    height: 48,
    color: '#292929',
  },
  dateButton: {
    borderWidth: 2,
    borderColor: '#585757',
    borderRadius: 8,
    padding: 14,
    backgroundColor: 'white',
    alignItems: 'center',
  },
  dateButtonExpanded: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#585757',
    borderRadius: 8,
    padding: 14,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateButtonText: {
    color: '#292929',
    fontSize: 14,
    fontWeight: '500',
  },
  dateNavigationContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dateNavButton: {
    width: 50,
    height: 48,
    borderWidth: 2,
    borderColor: '#585757',
    borderRadius: 8,
    backgroundColor: '#FC6A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  todayButton: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#FC6A0A',
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'white',
    alignItems: 'center',
  },
  todayButtonText: {
    color: '#FC6A0A',
    fontSize: 13,
    fontWeight: '600',
  },
  searchInput: {
    borderWidth: 2,
    borderColor: '#585757',
    borderRadius: 8,
    padding: 14,
    backgroundColor: 'white',
    color: '#292929',
    fontSize: 14,
  },
  reportCard: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportHeader: {
    backgroundColor: '#292929',
    padding: 20,
  },
  reportTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#585757',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#585757',
    fontSize: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#585757',
    borderBottomWidth: 2,
    borderBottomColor: '#292929',
  },
  tableHeaderCell: {
    padding: 12,
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#585757',
  },
  tableRowEven: {
    backgroundColor: '#F5ECE4',
  },
  tableRowOdd: {
    backgroundColor: 'white',
  },
  tableCell: {
    padding: 12,
    color: '#292929',
    fontSize: 12,
  },
  colNo: {
    width: 50,
  },
  colInvoice: {
    width: 150,
  },
  colDate: {
    width: 200,
  },
  colProduct: {
    width: 250,
  },
  colPrice: {
    width: 130,
  },
  colPayment: {
    width: 150,
  },
  productText: {
    fontSize: 12,
    color: '#292929',
    marginBottom: 4,
  },
  priceText: {
    color: '#FC6A0A',
    fontWeight: '600',
  },
  paymentBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  paymentCash: {
    backgroundColor: '#E74504',
  },
  paymentQris: {
    backgroundColor: '#FC6A0A',
  },
  paymentTransfer: {
    backgroundColor: '#585757',
  },
  paymentBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default TransactionReport;