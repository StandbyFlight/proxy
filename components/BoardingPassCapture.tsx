import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet,
  ActivityIndicator, Alert, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { colors } from '../lib/theme'
import { fonts, type } from '../lib/typography'
import { haptics } from '../lib/haptics'
import { GlassButton } from './ui'

export type BoardingPassData = {
  flight_number: string | null
  origin: string | null
  destination: string | null
  departure_date: string | null
  departure_time: string | null
  boarding_time: string | null
  arrival_date: string | null
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
      // 800px / 60% is plenty for Claude to read boarding pass text and keeps
      // the base64 payload under ~200KB — well within React Native fetch limits.
      const resized = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      )

      if (!resized.base64) throw new Error('Failed to process image.')
      const base64 = resized.base64
      console.log('[boarding-pass] base64 size (chars):', base64.length)

      // Direct fetch instead of supabase.functions.invoke — the SDK's abstraction
      // wraps any network failure as a generic "Failed to send request" error that
      // hides the real cause. Direct fetch surfaces the actual HTTP status/body.
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(
        `${supabaseUrl}/functions/v1/parse-boarding-pass`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${session?.access_token ?? supabaseAnonKey}`,
          },
          body: JSON.stringify({ image_base64: base64, media_type: 'image/jpeg' }),
        }
      )

      if (!res.ok) {
        const text = await res.text()
        console.error('[boarding-pass] edge function error', res.status, text)
        throw new Error(`Server error ${res.status}. Try again.`)
      }

      const data = await res.json()
      console.log('[boarding-pass] parsed result:', JSON.stringify(data))

      // flight_number is optional — the server nulls it whenever the raw value
      // fails its regex, independently of the other fields. Accept the parse if
      // the core session fields exist (origin + departure_date + departure_time)
      // OR a flight number came through; the edit screen lets the user fill any
      // remaining gaps and flight.tsx's canConfirm still gates issuing a pass.
      const hasCore = !!(data?.origin && data?.departure_date && data?.departure_time)
      const hasFlightNumber = !!data?.flight_number

      if (!hasCore && !hasFlightNumber && !data?.origin && !data?.destination && !data?.departure_date) {
        console.warn('[boarding-pass] parse failed: no usable fields in result')
        throw new Error("Couldn't read the boarding pass. Try a clearer, well-lit photo.")
      }

      const optionalMissing = (
        ['flight_number', 'origin', 'destination', 'departure_date', 'departure_time', 'gate', 'terminal'] as const
      ).filter(k => !data?.[k])
      if (optionalMissing.length === 0) {
        console.log('[boarding-pass] parse OK: all fields present')
      } else {
        console.log(
          '[boarding-pass] parse OK with minimum viable fields',
          hasCore ? '(origin+date+time)' : '(flight_number)',
          '— missing:', optionalMissing.join(', '),
        )
      }

      haptics.success()
      onParsed(data as BoardingPassData)
    } catch (err: any) {
      console.error('[boarding-pass] parseImage error:', err)
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
        <View style={styles.btnGroup}>
          {/* GlassButton fires haptics.buttonTap itself — no manual tap here. */}
          <GlassButton label="Try again" onPress={() => setMode('choose')} />
          <GlassButton label="Cancel" variant="ghost" onPress={onClose} />
        </View>
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
      <Text style={styles.subhead}>Take a photo or upload a screenshot of one you already have.</Text>

      <View style={styles.btnGroup}>
        {/* GlassButton fires haptics.buttonTap itself — no manual tap here. */}
        <GlassButton label="Take a photo" onPress={openCamera} />
        <GlassButton label="Upload from photos" variant="secondary" onPress={pickFromLibrary} />
        <GlassButton label="Cancel" variant="ghost" onPress={onClose} />
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
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.subtle,
    marginTop: 16,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.error,
    lineHeight: 22,
  },
  btnGroup: { gap: 10, width: '100%', marginTop: 8 },
  cameraUI: { flex: 1, justifyContent: 'space-between' },
  cameraBack: { padding: 20 },
  cameraBackText: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#fff',
  },
  cameraBottom: { alignItems: 'center', gap: 20, paddingBottom: 48 },
  cameraHint: {
    fontFamily: fonts.body,
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
