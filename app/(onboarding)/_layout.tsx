import { Slot } from 'expo-router'
import { GradientBackground } from '../../components/ui'

export default function OnboardingLayout() {
  return (
    <GradientBackground>
      <Slot />
    </GradientBackground>
  )
}
