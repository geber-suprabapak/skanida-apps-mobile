import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoadingScreen from './screens/loadingscreen';
import LoginScreen from './screens/login';


const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Loading" component={LoadingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}
