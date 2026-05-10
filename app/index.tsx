import { View, ActivityIndicator } from 'react-native'
import { colors } from '../lib/theme'

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.subtle} />
    </View>
  )
}
