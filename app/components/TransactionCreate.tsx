import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TransactionCreate = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Transaction</Text>
      <Text>Form untuk membuat transaksi akan ditambahkan di sini.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
});

export default TransactionCreate;