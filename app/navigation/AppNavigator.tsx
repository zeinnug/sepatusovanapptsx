import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Login from '../components/Login';
import Logout from '../components/Logout';
import Inventory from '../components/Inventory';
import TransactionIndex from '../components/TransactionIndex';
import TransactionCreate from '../components/TransactionCreate';
import TransactionReport from '../components/TransactionReport';
import Monitoring from '../components/Monitoring';
import Dashboard from '../components/Dashboard';

// Define navigation param list
type RootStackParamList = {
  Login: undefined;
  Logout: undefined;
  Inventory: undefined;
  TransactionIndex: { showPrint?: boolean };
  TransactionCreate: undefined;
  TransactionReport: undefined;
  Monitoring: undefined;
  Dashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1E2A3A',
        },
        headerTintColor: '#00FFAA',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="Login"
        component={Login}
        options={{ title: 'Login' }}
      />
      <Stack.Screen
        name="Logout"
        component={Logout}
        options={{ title: 'Logout - SEPATU BY SOVAN' }}
      />
      <Stack.Screen
        name="Inventory"
        component={Inventory}
        options={{ title: 'Inventory' }}
      />
      <Stack.Screen
        name="TransactionIndex"
        component={TransactionIndex}
        options={{ title: 'Daftar Transaksi' }}
      />
      <Stack.Screen
        name="TransactionCreate"
        component={TransactionCreate}
        options={{ title: 'Buat Transaksi Baru' }}
      />
      <Stack.Screen
        name="TransactionReport"
        component={TransactionReport}
        options={{ title: 'Laporan Transaksi' }}
      />
      <Stack.Screen
        name="Monitoring"
        component={Monitoring}
        options={{ title: 'Monitoring' }}
      />
      <Stack.Screen
        name="Dashboard"
        component={Dashboard}
        options={{ title: 'Dashboard' }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;