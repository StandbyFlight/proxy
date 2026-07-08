import { ReactNode, useEffect, useRef } from 'react'
import {
  Modal,
  View,
  Pressable,
  Animated,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, radius, blur, shadow, spacing, gradients } from '../../lib/theme'

// A floating frosted panel presented over a dimmed, blurred backdrop. Soft
// fade + scale on enter — premium, not bouncy. Tap the scrim to dismiss
// (unless dismissOnBackdrop is false).

type Props = {
  visible: boolean
  onClose: () => void
  children: ReactNode
  dismissOnBackdrop?: boolean
  style?: StyleProp<ViewStyle>
}

export function GlassModal({
  visible,
  onClose,
  children,
  dismissOnBackdrop = true,
  style,
}: Props) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 240 : 160,
      useNativeDriver: true,
    }).start()
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.scrim, { opacity: anim }]}>
        <BlurView intensity={blur.subtle} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdrop ? onClose : undefined}
        />
        <Animated.View
          style={[
            styles.panelWrap,
            {
              opacity: anim,
              transform: [
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
              ],
            },
          ]}
        >
          <View style={[styles.panel, shadow.panel, style]}>
            <BlurView intensity={blur.panel} tint={blur.tint} style={StyleSheet.absoluteFill} />
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassWhiteStrong }]}
            />
            <LinearGradient
              colors={gradients.glassSheen}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.border} pointerEvents="none" />
            <View style={styles.content}>{children}</View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(20,20,25,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panelWrap: {
    width: '100%',
    maxWidth: 420,
  },
  panel: {
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderGlassStrong,
  },
  content: {
    padding: spacing.xl,
  },
})
