import React, { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, ImageBackground, ScrollView, ActivityIndicator, Alert, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Logout: undefined;
  Inventory: undefined;
  TransactionIndex: undefined;
  TransactionCreate: undefined;
  Monitoring: undefined;
};

type DashboardNavigationProp = StackNavigationProp<RootStackParamList, 'Dashboard'>;

interface DashboardResponse {
  data: {
    total_products: number;
    total_transactions: number;
    total_sales: string;
    hourly_data: number[];
    labels: string[];
    top_products: { name: string; quantity: string }[];
    recent_transactions: {
      id: number;
      created_at: string;
      user: { name: string };
      items: { product: { name: string } }[];
      final_amount: string;
      status: string;
    }[];
    message?: string;
  };
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUnits, setTotalUnits] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [hourlyData, setHourlyData] = useState<number[]>([]);
  const [hourlyLabels, setHourlyLabels] = useState<string[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number }[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<
    { id: number; created_at: string; user: { name: string }; items: { product: { name: string } }[]; final_amount: number; status: string }[]
  >([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const slideAnim = useState(new Animated.Value(-300))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];
  const navigation = useNavigation<DashboardNavigationProp>();
  const prevDataRef = useRef<DashboardResponse['data'] | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const AnimatedNumber: React.FC<{ value: number; isCurrency?: boolean }> = memo(({ value, isCurrency = false }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
      const duration = 1500;
      const steps = 60;
      const stepValue = value / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += stepValue;
        if (current >= value) {
          current = value;
          clearInterval(timer);
        }
        setDisplayValue(Math.floor(current));
      }, duration / steps);

      return () => clearInterval(timer);
    }, [value]);

    return (
      <Text style={styles.animatedNumber}>
        {isCurrency
          ? displayValue.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
          : displayValue.toLocaleString('id-ID')}
      </Text>
    );
  });

  const StatCard: React.FC<{ title: string; value: number; icon: string; delay?: number }> = memo(({ title, value, icon, delay = 0 }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    }, [delay]);

    return (
      <Animated.View
        style={[
          styles.statCard,
          {
            opacity: isVisible ? 1 : 0,
            transform: [{ translateY: isVisible ? 0 : 20 }],
          },
        ]}
      >
        <View style={styles.statCardGradient}>
          <View style={styles.statCardHeader}>
            <Text style={styles.statCardTitle}>{title}</Text>
          </View>
          <View style={styles.statCardContent}>
            <View style={styles.statCardIcon}>
              <Text style={styles.statCardIconText}>{icon}</Text>
            </View>
            <View style={styles.statCardValue}>
              {title.includes('Penjualan') ? (
                <AnimatedNumber value={value} isCurrency={true} />
              ) : (
                <AnimatedNumber value={value} />
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    );
  });

  const SimpleBarChart: React.FC<{ data: number[]; labels: string[]; title: string; subtitle: string }> = memo(({ data, labels, title, subtitle }) => {
    const maxValue = Math.max(...data, 1);
    const colors = ['#7c3636ff', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];

    return (
      <View style={styles.barChartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.chartSubtitle}>
          {subtitle} (Diperbarui: {currentTime.toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })})
        </Text>
        {data.length === 0 ? (
          <Text style={styles.noDataText}>Tidak ada data untuk ditampilkan</Text>
        ) : (
          <>
            <View style={styles.barContainer}>
              {data.map((value, index) => (
                <View key={index} style={styles.barItem}>
                  <Animated.View
                    style={[
                      styles.bar,
                      {
                        height: (value / maxValue) * 100,
                        backgroundColor: colors[index % colors.length],
                        animationDelay: `${index * 100}ms`,
                      },
                    ]}
                  />
                  <Text style={styles.barValue}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={styles.barLabels}>
              {labels.map((label, index) => (
                <Text key={index} style={styles.barLabel}>
                  {label.length > 8 ? label.substring(0, 8) + '...' : label}
                </Text>
              ))}
            </View>
          </>
        )}
      </View>
    );
  });

  const SimplePieChart: React.FC<{ data: { name: string; quantity: number }[]; title: string; subtitle: string }> = memo(({ data, title, subtitle }) => {
    const total = data.reduce((sum, item) => sum + item.quantity, 0);
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

    return (
      <View style={styles.pieChartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.chartSubtitle}>
          {subtitle} (Diperbarui: {currentTime.toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })})
        </Text>
        {data.length === 0 ? (
          <Text style={styles.noDataText}>Tidak ada data untuk ditampilkan</Text>
        ) : (
          data.map((item, index) => (
            <View key={index} style={styles.pieItem}>
              <View style={[styles.pieColor, { backgroundColor: colors[index % colors.length] }]} />
              <View style={styles.pieTextContainer}>
                <Text style={styles.pieName}>{item.name || '-'}</Text>
                <Text style={styles.pieCount}>{item.quantity || 0} unit</Text>
              </View>
              <Text style={styles.piePercentage}>
                {total > 0 ? ((item.quantity / total) * 100).toFixed(1) : 0}%
              </Text>
            </View>
          ))
        )}
      </View>
    );
  });

  const TransactionTable: React.FC<{
    transactions: { id: number; created_at: string; user: { name: string }; items: { product: { name: string } }[]; final_amount: number; status: string }[];
  }> = memo(({ transactions }) => {
    const { width } = Dimensions.get('window');
    const cellWidths = {
      id: width * 0.12,
      date: width * 0.28,
      user: width * 0.22,
      products: width * 0.30,
      amount: width * 0.18,
      status: width * 0.15,
    };

    const totalTableWidth = Object.values(cellWidths).reduce((sum, val) => sum + val, 0);

    const formatDate = (dateString: string) => {
      try {
        const [day, month, year, time] = dateString.split(/[- ]/);
        const date = new Date(`${year}-${month}-${day}T${time}:00`);
        return date.toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return dateString || '-';
      }
    };

    const formatCurrency = (amount: number) => {
      return amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    return (
      <View style={styles.tableContainer}>
        <Text style={styles.sectionTitle}>Detail Transaksi</Text>
        {transactions.length === 0 ? (
          <Text style={styles.noDataText}>Tidak ada transaksi hari ini</Text>
        ) : (
          <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={true}
            style={[styles.tableScroll, { width: '100%' }]}
            contentContainerStyle={{ width: totalTableWidth }}
          >
            <ScrollView
              style={[styles.tableVerticalScroll, { maxHeight: Math.max(400, transactions.length * 70) }]}
              showsVerticalScrollIndicator={true}
            >
              <View style={[styles.tableContent, { width: totalTableWidth }]}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: cellWidths.id }]}>ID</Text>
                  <Text style={[styles.tableHeaderCell, { width: cellWidths.date }]}>Tanggal</Text>
                  <Text style={[styles.tableHeaderCell, { width: cellWidths.user }]}>Kasir</Text>
                  <Text style={[styles.tableHeaderCell, { width: cellWidths.products }]}>Produk</Text>
                  <Text style={[styles.tableHeaderCell, { width: cellWidths.amount }]}>Total</Text>
                  <Text style={[styles.tableHeaderCell, { width: cellWidths.status }]}>Status</Text>
                </View>
                {transactions.map((item, index) => {
                  const rowStyle = index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd;
                  return (
                    <View key={item.id || `transaction-${index}`} style={[styles.tableRow, rowStyle, { width: totalTableWidth }]}>
                      <Text style={[styles.tableCell, { width: cellWidths.id }]} numberOfLines={2} ellipsizeMode="tail">
                        {item.id || '-'}
                      </Text>
                      <Text style={[styles.tableCell, { width: cellWidths.date }]} numberOfLines={2} ellipsizeMode="tail">
                        {formatDate(item.created_at)}
                      </Text>
                      <Text style={[styles.tableCell, { width: cellWidths.user }]} numberOfLines={2} ellipsizeMode="tail">
                        {item.user?.name || 'Unknown'}
                      </Text>
                      <Text style={[styles.tableCell, { width: cellWidths.products }]} numberOfLines={3} ellipsizeMode="tail">
                        {item.items?.length ? item.items.map(i => i.product?.name || '-').join(', ') : '-'}
                      </Text>
                      <Text style={[styles.tableCell, { width: cellWidths.amount }]} numberOfLines={2} ellipsizeMode="tail">
                        {formatCurrency(item.final_amount || 0)}
                      </Text>
                      <Text style={[styles.tableCell, { width: cellWidths.status, color: '#10B981' }]} numberOfLines={2} ellipsizeMode="tail">
                        {item.status || '-'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>
        )}
      </View>
    );
  });

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('Token tidak ditemukan. Silakan login ulang.');
      }

      const response = await fetch('https://testingaplikasi.tokosepatusovan.com/api/dashboard', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      console.log('Status:', response.status);
      const text = await response.text();
      console.log('Raw Response:', text);

      let data: DashboardResponse;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new Error('Server tidak mengembalikan JSON valid: ' + text.slice(0, 100));
      }

      if (!response.ok) {
        throw new Error(data.data?.message || `Gagal mengambil data dari API: ${response.status}`);
      }

      const newData = data.data || {};

      const parsedData = {
        total_products: newData.total_products || 0,
        total_transactions: newData.total_transactions || 0,
        total_sales: parseFloat(newData.total_sales || '0') || 0,
        hourly_data: newData.hourly_data || [],
        labels: newData.labels || [],
        top_products: (newData.top_products || []).map(product => ({
          name: product.name || '-',
          quantity: parseInt(product.quantity, 10) || 0,
        })),
        recent_transactions: (newData.recent_transactions || []).map(transaction => ({
          ...transaction,
          final_amount: parseFloat(transaction.final_amount) || 0,
        })),
      };

      const prevTransactions = prevDataRef.current?.recent_transactions || [];
      const newTransactions = parsedData.recent_transactions;
      const hasNewTransactions =
        prevTransactions.length !== newTransactions.length ||
        !prevTransactions.every((prev, index) => prev.id === newTransactions[index]?.id);

      prevDataRef.current = newData;

      if (hasNewTransactions || loading) {
        setTotalUnits(parsedData.total_products);
        setTotalTransactions(parsedData.total_transactions);
        setTotalSales(parsedData.total_sales);
        setHourlyData(parsedData.hourly_data);
        setHourlyLabels(parsedData.labels);
        setTopProducts(parsedData.top_products);
        setRecentTransactions(parsedData.recent_transactions);
        setLoading(false);
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message.includes('Token tidak ditemukan') || (err as any).response?.status === 401
            ? 'Sesi login habis. Silakan login ulang.'
            : `Gagal mengambil data: ${err.message}`
          : 'Terjadi kesalahan tidak diketahui';
      setError(errorMsg);
      setLoading(false);
      Alert.alert('Error', errorMsg, [{ text: 'OK', onPress: () => navigation.replace('Login') }]);
    }
  }, [navigation, loading]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: menuVisible ? 0 : -300,
      duration: 300,
      useNativeDriver: true,
    }).start();

    Animated.timing(fadeAnim, {
      toValue: loading ? 0 : 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [menuVisible, loading]);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      navigation.replace('Login');
    } catch {
      Alert.alert('Error', 'Gagal logout. Silakan coba lagi.');
    }
    setMenuVisible(false);
  };

  const filteredHourlyData = useMemo(() => {
    const currentHour = currentTime.getHours();
    return hourlyData.slice(0, currentHour + 1).filter(data => data > 0);
  }, [hourlyData, currentTime]);

  const filteredHourlyLabels = useMemo(() => {
    const currentHour = currentTime.getHours();
    return hourlyLabels.slice(0, currentHour + 1).filter((_, index) => hourlyData[index] > 0);
  }, [hourlyLabels, hourlyData, currentTime]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Memuat Data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.replace('Login')}>
          <Text style={styles.buttonText}>Kembali ke Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2574&q=80' }}
        style={styles.heroSection}
        imageStyle={{ resizeMode: 'cover' }}
      >
        <View style={styles.heroOverlay} />
        <Animated.View
          style={[
            styles.heroTextContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }],
            },
          ]}
        >
          <Text style={styles.heroText}>@SEPATUBYSOVAN</Text>
        </Animated.View>
        <TouchableOpacity style={styles.hamburgerButton} onPress={() => setMenuVisible(true)}>
          <Icon name="menu" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </ImageBackground>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>LAPORAN HARIAN</Text>
        <Animated.View style={[styles.cardContainer, { opacity: fadeAnim }]}>
          <StatCard title="Total Unit" value={totalUnits} icon="👟" delay={200} />
          <StatCard title="Transaksi Hari Ini" value={totalTransactions} icon="🛒" delay={400} />
          <StatCard title="Penjualan Hari Ini" value={totalSales} icon="💰" delay={600} />
        </Animated.View>

        <View style={styles.chartsContainer}>
          <SimpleBarChart
            data={filteredHourlyData}
            labels={filteredHourlyLabels}
            title="Transaksi per Jam"
            subtitle="Laporan Transaksi Harian"
          />
          <SimplePieChart
            data={topProducts}
            title="Distribusi Unit per Produk"
            subtitle="Jumlah Unit per Produk"
          />
        </View>

        <TransactionTable transactions={recentTransactions} />
      </ScrollView>

      <Modal animationType="none" transparent={true} visible={menuVisible} onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContainer, { transform: [{ translateX: slideAnim }] }]}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setMenuVisible(false)}>
              <Icon name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                navigation.navigate('Inventory');
                setMenuVisible(false);
              }}
            >
              <Text style={styles.menuText}>Lihat Inventory</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                navigation.navigate('TransactionIndex');
                setMenuVisible(false);
              }}
            >
              <Text style={styles.menuText}>Buat Transaksi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                navigation.navigate('Monitoring');
                setMenuVisible(false);
              }}
            >
              <Text style={styles.menuText}>Monitoring Pengunjung</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.logoutButton]} onPress={handleLogout}>
              <Text style={styles.menuText}>Logout</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    width: '100%',
  },
  loadingText: {
    color: '#1E3A8A',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroSection: {
    height: 192,
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)', // Reduced opacity for clearer image
  },
  heroTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // More transparent background
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  heroText: {
    color: '#FFFFFF', // Changed to white for better contrast
    fontSize: 22, // Slightly larger for emphasis
    fontWeight: '800',
    fontFamily: 'serif',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)', // Added text shadow for readability
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 4,
  },
  hamburgerButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 12,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  content: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    width: '100%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 24,
    color: '#1E3A8A',
    textTransform: 'uppercase',
  },
  cardContainer: {
    marginBottom: 32,
  },
  statCard: {
    marginBottom: 16,
  },
  statCardGradient: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  statCardHeader: {
    backgroundColor: '#EFF6FF',
    padding: 8,
  },
  statCardTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  statCardContent: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    padding: 16,
  },
  statCardIcon: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  statCardIconText: {
    fontSize: 24,
  },
  statCardValue: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animatedNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  chartsContainer: {
    marginBottom: 32,
  },
  barChartContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  chartTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  chartSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 16,
  },
  barContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 128,
    marginBottom: 16,
  },
  barItem: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 32,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barValue: {
    color: '#D1D5DB',
    fontSize: 12,
    marginTop: 8,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  barLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    flex: 1,
  },
  pieChartContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  pieItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  pieColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 12,
  },
  pieTextContainer: {
    flex: 1,
  },
  pieName: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  pieCount: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  piePercentage: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 32,
    flexShrink: 1,
  },
  tableScroll: {
    flexGrow: 0,
  },
  tableVerticalScroll: {
    maxHeight: 'auto',
  },
  tableContent: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'left',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: 60,
  },
  tableRowEven: {
    backgroundColor: '#F9FAFB',
  },
  tableRowOdd: {
    backgroundColor: '#FFFFFF',
  },
  tableCell: {
    color: '#1F2937',
    fontSize: 12,
    textAlign: 'left',
    paddingVertical: 8,
    paddingHorizontal: 8,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  modalContainer: {
    width: 280,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 8,
  },
  menuItem: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  logoutButton: {
    backgroundColor: '#DC2626',
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  noDataText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 16,
  },
});

export default Dashboard;