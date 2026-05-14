import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../lib/theme'
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
      const { granted } = await requestPermission()
      if (!granted) return
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
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity style={styles.button} onPress={() => setMode('choose')}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (mode === 'camera') {
    return (
      <View style={styles.full}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <SafeAreaView style={styles.cameraUI}>
          <TouchableOpacity onPress={() => setMode('choose')} style={styles.cameraBack}>
            <Text style={styles.cameraBackText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.cameraBottom}>
            <Text style={styles.cameraHint}>Frame your boarding pass so all text is visible</Text>
            <TouchableOpacity style={styles.shutter} onPress={() => { haptics.buttonTap(); takePicture() }} />
          </View>
        </SafeAreaView>
      </View>
    )
  }

  return (
    <View style={styles.center}>
      <Text style={styles.heading}>Add your boarding pass</Text>
      <Text style={styles.sub}>Take a photo or upload one you already have.</Text>

      <TouchableOpacity style={styles.button} onPress={() => { haptics.buttonTap(); openCamera() }}>
        <Text style={styles.buttonText}>Take a photo</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonSecondary} onPress={() => { haptics.buttonTap(); pickFromLibrary() }}>
        <Text style={styles.buttonSecondaryText}>Upload from photos</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose} style={styles.cancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  sub: { fontSize: 15, color: colors.subtle, textAlign: 'center', marginBottom: 8 },
  loadingText: { fontSize: 15, color: colors.subtle, marginTop: 16 },
  errorText: { fontSize: 15, color: colors.error, textAlign: 'center', marginBottom: 8 },
  button: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: '600' },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    width: '100%',
  },
  buttonSecondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  cancel: { marginTop: 4 },
  cancelText: { fontSize: 15, color: colors.subtle },
  cameraUI: { flex: 1, justifyContent: 'space-between' },
  cameraBack: { padding: 20 },
  cameraBackText: { color: '#fff', fontSize: 15 },
  cameraBottom: { alignItems: 'center', gap: 20, paddingBottom: 48 },
  cameraHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
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
