import { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { colors } from '../../../lib/theme'

// Group deep-link router — mirrors match/room. Reads group status and forwards
// to forming / mutual / meetup as appropriate. Stubbed at MVP because the
// group backend doesn't exist yet (see app_plan §20); defaults to forming.

export default function GroupRoom() {
  const { group_id } = useLocalSearchParams<{ group_id?: string }>()
  const router = useRouter()

  useEffect(() => {
    // No groups table yet — bounce to forming and let it show its placeholder.
    router.replace({
      pathname: '/(app)/group/forming',
      params: group_id ? { group_id } : {},
    })
  }, [group_id])

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.subtle} />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
})
