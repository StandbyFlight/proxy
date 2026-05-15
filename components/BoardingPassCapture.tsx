import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet,
  ActivityIndicator, SafeAreaView, Alert, Linking,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../lib/theme'
import { fonts, type } from '../lib/typography'
import { haptics } from '../lib/haptics'

export type BoardingPassData = {
  flight_number: string | null
  origin: string | null
  destination: string | null
  departure_date: string | null
  departure_time: string | null
  terminal: string | null
  gate: string | null
  passenger_name: string | null
}

type Props = {
  onParsed: (data: BoardingPassData) => void
  onClose: () => void
}

type Mode = 'choose' | 'camera' | 'loading' | 'error'

export function BoardingPassCapture({ onParsed, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('choose')
  const [errorMsg, setErrorMsg] = useState('')
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)

  async function parseImage(uri: string) {
    setMode('loading')
    try {
      const resized = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      )

      if (!resized.base64) throw new Error('Failed to process image.')
      const base64 = resized.base64

      const { data, error } = await supabase.functions.invoke('parse-boarding-pass', {
        body: { image_base64: base64, media_type: 'image/jpeg' },
      })

      if (error) throw new Error(error.message)
      if (!data?.flight_number) {
        throw new Error("Couldn't read the boarding pass — try a clearer, well-lit photo.")
      }

      haptics.success()
      onParsed(data as BoardingPassData)
    } catch (err: any) {
      haptics.error()
      setErrorMsg(err.message ?? 'Something went wrong.')
      setMode('error')
    }
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    })
    if (!result.canceled) await parseImage(result.assets[0].uri)
  }

  async function openCamera() {
    if (!permission?.granted) {
      const result = await requestPermission()
      if (!result.granted) {
        if (!result.canAskAgain) {
          Alert.alert(
            'Camera Access Required',
            'Please enable camera access in Settings to scan your boarding pass.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          )
        }
        return
      }
    }
    setMode('camera')
  }

  async function takePicture() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 1 })
    if (photo?.uri) await parseImage(photo.uri)
  }

  if (mode === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={styles.loadingText}>Reading boarding pass...</Text>
      </View>
    )
  }

  if (mode === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.eyebrow}>Couldn't read it</Text>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          onPress={() => { haptics.buttonTap(); setMode('choose') }}
        >
          <Text style={styles.primaryBtnText}>Try again</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={12} style={styles.ghostLink}>
          <Text style={styles.ghostLinkText}>Cancel</Text>
        </Pressable>
      </View>
    )
  }

  if (mode === 'camera') {
    return (
      <View style={styles.full}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <SafeAreaView style={styles.cameraUI}>
          <Pressable
            onPress={() => { haptics.buttonTap(); setMode('choose') }}
            style={styles.cameraBack}
            hitSlop={12}
          >
            <Text style={styles.cameraBackText}>Back</Text>
          </Pressable>
          <View style={styles.cameraBottom}>
            <Text style={styles.cameraHint}>Frame your boarding pass so all text is visible</Text>
            <Pressable
              style={({ pressed }) => [styles.shutter, pressed && { opacity: 0.8 }]}
              onPress={() => { haptics.buttonTap(); takePicture() }}
            />
          </View>
        </SafeAreaView>
      </View>
    )
  }

  return (
    <View style={styles.center}>
      <Text style={styles.eyebrow}></Text>
      <Text style={styles.headline}>Add your{'\n'}boarding pass.</Text>
      <Text style={styles.subhead}>Take a photo or upload one you already have.</Text>

      <View style={styles.btnGroup}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, { width: '100%' }, pressed && { opacity: 0.85 }]}
          onPress={() => { haptics.buttonTap(); openCamera() }}
        >
          <Text style={styles.primaryBtnText}>Take a photo</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
          onPress={() => { haptics.buttonTap(); pickFromLibrary() }}
        >
          <Text style={styles.secondaryBtnText}>Upload from photos</Text>
        </Pressable>

        <Pressable onPress={onClose} hitSlop={12} style={styles.ghostLink}>
          <Text style={styles.ghostLinkText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  eyebrow: { ...type.eyebrow, color: colors.subtle },
  headline: { ...type.headline, color: colors.text, marginTop: 4 },
  subhead: { ...type.subhead, color: colors.subtle, marginTop: 2 },
  loadingText: {
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    color: colors.subtle,
    marginTop: 16,
  },
  errorText: {
    fontFamily: fonts.serifItalic,
    fontSize: 15,
    color: colors.error,
    lineHeight: 22,
  },
  btnGroup: { gap: 10, width: '100%', marginTop: 8 },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.bg,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
    width: '100%',
  },
  secondaryBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.subtle,
  },
  ghostLink: { alignSelf: 'center', paddingVertical: 8 },
  ghostLinkText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.subtle,
  },
  cameraUI: { flex: 1, justifyContent: 'space-between' },
  cameraBack: { padding: 20 },
  cameraBackText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#fff',
  },
  cameraBottom: { alignItems: 'center', gap: 20, paddingBottom: 48 },
  cameraHint: {
    fontFamily: fonts.serifItalic,
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
  },
})
