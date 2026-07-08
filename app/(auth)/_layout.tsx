import { Slot } from 'expo-router'
import { GradientBackground } from '../../components/ui'

export default function AuthLayout() {
  return (
    <GradientBackground>
      <Slot />
    </GradientBackground>
  )
}
