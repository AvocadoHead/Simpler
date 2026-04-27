export interface DeviceInfo {
  isIOS: boolean
  isMobile: boolean
}

export function detectDevice(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  platform = typeof navigator !== 'undefined' ? navigator.platform : '',
  maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0
): DeviceInfo {
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
  const isMobile = isIOS || /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)

  return { isIOS, isMobile }
}

export function getBestRecorderMimeType(isTypeSupported: (type: string) => boolean): string {
  if (isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (isTypeSupported('audio/webm')) return 'audio/webm'
  if (isTypeSupported('audio/mp4')) return 'audio/mp4'
  return ''
}

export function getRecordingErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Microphone permission was blocked. Allow microphone access and try again.'
    }

    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No microphone was found on this device.'
    }

    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'The microphone is already in use by another app.'
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Recording failed. Please try again.'
}
