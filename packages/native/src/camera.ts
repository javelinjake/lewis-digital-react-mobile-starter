import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { isNativePlatform } from './platform'

export interface CapturedPhoto {
  webPath: string
  format: string
  blob: Blob
}

export interface CapturePhotoOptions {
  quality?: number
  allowEditing?: boolean
  maxSize?: number
}

async function toCapturedPhoto(webPath: string | undefined, format: string): Promise<CapturedPhoto> {
  if (!webPath)
    throw new Error('No photo was returned')

  const response = await fetch(webPath)
  const blob = await response.blob()
  return { webPath, format, blob }
}

async function capture(source: CameraSource, options: CapturePhotoOptions = {}) {
  const photo = await Camera.getPhoto({
    source,
    quality: options.quality ?? 85,
    allowEditing: options.allowEditing ?? false,
    width: options.maxSize,
    height: options.maxSize,
    resultType: CameraResultType.Uri,
    correctOrientation: true,
  })

  return toCapturedPhoto(photo.webPath, photo.format)
}

export function takePhoto(options?: CapturePhotoOptions) {
  const source = isNativePlatform() || customElements.get('pwa-camera-modal')
    ? CameraSource.Camera
    : CameraSource.Photos

  return capture(source, options)
}

export function pickPhoto(options?: CapturePhotoOptions) {
  return capture(CameraSource.Photos, options)
}

export async function requestCameraPermissions() {
  if (!isNativePlatform())
    return true

  const status = await Camera.requestPermissions({ permissions: ['camera', 'photos'] })
  return status.camera === 'granted' || status.camera === 'limited'
}
