import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TransactionIndex = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transaction Index</Text>
      <Text>Daftar transaksi akan ditampilkan di sini.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
});

export default TransactionIndex;