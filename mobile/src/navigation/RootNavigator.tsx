import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useGameStore } from '../store/gameStore';
import { colors } from '../theme';
import { HomePage } from '../pages/HomePage';
import { GuidePage } from '../pages/GuidePage';
import { RoomStub } from '../pages/RoomStub';

const Stack = createNativeStackNavigator();

// Store-driven navigation (React Navigation's recommended state-conditional
// pattern): once the server seats us (roomId set) the stack swaps to the Room
// screen; leaving/room-closed clears roomId and returns to Home. Screens are
// transparent so the app's gradient shows through.
export function RootNavigator() {
  const roomId = useGameStore((s) => s.roomId);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'fade',
      }}
    >
      {roomId ? (
        <Stack.Screen name="Room" component={RoomStub} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomePage} />
          <Stack.Screen
            name="Guide"
            component={GuidePage}
            options={{
              headerShown: true,
              title: 'How to Play',
              headerStyle: { backgroundColor: '#2E1720' },
              headerTintColor: colors.gold,
              headerTitleStyle: { color: colors.cream },
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
