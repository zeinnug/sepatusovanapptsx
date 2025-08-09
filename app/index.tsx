import React from 'react';
import { Redirect } from 'expo-router'; // Jika menggunakan Expo Router

const Index = () => {
  return <Redirect href="/login" />; // Arahkan ke halaman login secara default
};

export default Index;