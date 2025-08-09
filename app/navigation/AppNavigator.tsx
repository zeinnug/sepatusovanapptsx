import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import Login from '../components/Login';
import Logout from '../components/Logout';
import Inventory from '../components/Inventory';
import TransactionIndex from '../components/TransactionIndex';
import TransactionCreate from '../components/TransactionCreate';
import Monitoring from '../components/Monitoring';
import Dashboard from '../components/Dashboard';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Logout" component={Logout} />
      <Stack.Screen name="Inventory" component={Inventory} />
      <Stack.Screen name="TransactionIndex" component={TransactionIndex} />
      <Stack.Screen name="TransactionCreate" component={TransactionCreate} />
      <Stack.Screen name="Monitoring" component={Monitoring} />
      <Stack.Screen name="Dashboard" component={Dashboard} />
    </Stack.Navigator>
  );
};

export default AppNavigator;