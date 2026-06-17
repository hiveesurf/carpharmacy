import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock, X } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { Button } from '../ui/Button'
import { getAccessToken } from '../../lib/authTokens.js'
import { resolveSessionRole } from '../../lib/jwtPayload.js'
import { postLoginPathForRole } from '../../lib/postLoginPath.js'

const OTP_MIN_LENGTH = 6

function normalizeMobileInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length <= 10) return digits
  return digits.slice(-10)
}

function resolveOtpTtlSeconds(data) {
  const ttl = data?.ttlSeconds
  return typeof ttl === 'number' && ttl > 0 ? ttl : 20
}

export function AuthModals() {
  const navigate = useNavigate()
  const { modalOpen, closeAuth, sendOtp, verifyOtp } = useAuth()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('phone')
  const [message, setMessage] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [otpExpiresIn, setOtpExpiresIn] = useState(0)
  const [otpExpired, setOtpExpired] = useState(false)

  const clearOtpFlow = useCallback(() => {
    setOtp('')
    setOtpExpiresIn(0)
    setOtpExpired(false)
  }, [])

  const reset = useCallback(() => {
    setPhone('')
    clearOtpFlow()
    setStep('phone')
    setMessage('')
    setSendingOtp(false)
    setVerifying(false)
  }, [clearOtpFlow])

  const beginOtpCountdown = useCallback((sendData) => {
    setOtpExpired(false)
    setOtpExpiresIn(resolveOtpTtlSeconds(sendData))
  }, [])

  const applySendOtpData = useCallback(
    (sendData) => {
      beginOtpCountdown(sendData)
    },
    [beginOtpCountdown],
  )

  const handleClose = () => {
    reset()
    closeAuth()
  }

  useEffect(() => {
    if (step !== 'otp' || otpExpired) return undefined
    const id = window.setInterval(() => {
      setOtpExpiresIn((prev) => {
        if (prev <= 1) {
          setOtpExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [step, otpExpired])

  const onSendOtp = async (e) => {
    e?.preventDefault?.()
    if (sendingOtp || phone.length !== 10) return
    setMessage('')
    setSendingOtp(true)
    try {
      const r = await sendOtp(phone)
      if (!r.ok) {
        setMessage(r.message)
        return
      }
      clearOtpFlow()
      setStep('otp')
      applySendOtpData(r.data)
    } finally {
      setSendingOtp(false)
    }
  }

  const onResendOtp = async () => {
    if (!otpExpired || sendingOtp) return
    setMessage('')
    setSendingOtp(true)
    try {
      const r = await sendOtp(phone)
      if (!r.ok) {
        setMessage(r.message)
        return
      }
      setOtp('')
      applySendOtpData(r.data)
    } finally {
      setSendingOtp(false)
    }
  }

  const onVerify = async (e) => {
    e.preventDefault()
    if (verifying || otpExpired) return
    if (otp.length < OTP_MIN_LENGTH) return
    setMessage('')
    setVerifying(true)
    try {
      const r = await verifyOtp(phone, otp)
      if (!r.ok) setMessage(r.message)
      else {
        reset()
        const role = resolveSessionRole(r.user, getAccessToken())
        const staffPath = postLoginPathForRole(role)
        if (staffPath) {
          navigate(staffPath, { replace: true })
        }
      }
    } finally {
      setVerifying(false)
    }
  }

  const onChangeNumber = () => {
    clearOtpFlow()
    setStep('phone')
    setMessage('')
  }

  const otpValid = otp.length >= OTP_MIN_LENGTH
  const canVerify = otpValid && !otpExpired && !verifying

  return (
    <AnimatePresence>
      {modalOpen && (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[85] bg-ink/75 backdrop-blur-sm"
            aria-label="Close"
            onClick={handleClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="fixed left-1/2 top-1/2 z-[95] max-h-[min(92vh,640px)] w-[min(100%,420px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-fog/15 bg-graphite p-6 shadow-2xl clip-chamfer sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="auth-title" className="font-display text-2xl font-bold uppercase tracking-wide text-fog">
                  Sign in
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center border border-fog/15 text-fog"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {message && (
              <p className="mb-6 rounded border border-flare/40 bg-flare-muted px-3 py-2 text-sm text-fog">{message}</p>
            )}

            {step === 'phone' ? (
              <form onSubmit={onSendOtp} className="space-y-4">
                <div>
                  <label htmlFor="auth-phone" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-hud">
                    Mobile number
                  </label>
                  <input
                    id="auth-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(normalizeMobileInput(e.target.value))}
                    maxLength={10}
                    className="w-full border border-fog/15 bg-ink/50 px-3 py-2.5 font-sans text-fog outline-none focus:border-accent/50"
                    placeholder="9876543210"
                  />
                </div>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full disabled:cursor-not-allowed disabled:opacity-50"
                  type="submit"
                  disabled={sendingOtp || phone.length !== 10}
                >
                  {sendingOtp ? 'Sending…' : 'Send OTP'}
                </Button>
              </form>
            ) : (
              <form onSubmit={onVerify} className="space-y-4">
                <p className="font-sans text-sm text-mist">
                  Code sent to <span className="font-semibold text-fog">{phone}</span>
                </p>
                <div>
                  <label htmlFor="auth-otp" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-hud">
                    Enter OTP
                  </label>
                  <input
                    id="auth-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={otpExpired}
                    className="w-full border border-fog/15 bg-ink/50 px-3 py-2.5 font-sans text-fog outline-none focus:border-accent/50 tracking-[0.3em] disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="Enter code"
                    aria-invalid={otpExpired}
                  />
                  {!otpExpired && otpExpiresIn > 0 ? (
                    <p
                      className="mt-1 flex items-center justify-center gap-1 font-mono text-[10px] text-mist/65"
                      aria-live="polite"
                    >
                      <Clock className="h-3 w-3 shrink-0 text-mist/50" strokeWidth={1.75} aria-hidden />
                      <span>
                        OTP expires in{' '}
                        <span className="font-semibold text-accent">{otpExpiresIn}s</span>
                      </span>
                    </p>
                  ) : null}
                  {otpExpired ? (
                    <p className="mt-2 text-sm text-flare" role="alert">
                      OTP expired. Please request a new OTP.
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full disabled:cursor-not-allowed disabled:bg-accent/80 disabled:text-[var(--color-on-accent)] disabled:opacity-95 disabled:shadow-[0_6px_20px_-6px_rgba(255,107,53,0.35)] disabled:hover:brightness-100"
                  type="submit"
                  disabled={!canVerify}
                >
                  {verifying ? 'Verifying…' : 'Verify & continue'}
                </Button>
                {otpExpired ? (
                  <button
                    type="button"
                    className="w-full font-sans text-sm text-accent underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-mist disabled:no-underline"
                    disabled={sendingOtp}
                    onClick={() => void onResendOtp()}
                  >
                    {sendingOtp ? 'Sending…' : 'Resend OTP'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="w-full font-sans text-sm text-accent underline-offset-2 hover:underline"
                  onClick={onChangeNumber}
                >
                  Change number
                </button>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
