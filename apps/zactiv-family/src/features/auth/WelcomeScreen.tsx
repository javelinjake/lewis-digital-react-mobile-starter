import { useNavigate } from 'react-router'
import logo from '@/assets/logo.svg'
import { PrimaryButton } from '@/components/ui'
import { completeOnboarding } from '@/lib/family-data'

export function WelcomeScreen() {
  const navigate = useNavigate()

  return (
    <main className="screen">
      <img src={logo} alt="Zactiv Family" className="mb-8 h-12" />
      <h1 className="mb-3 text-3xl font-bold">Welcome to the Zactiv Family</h1>
      <p className="mb-8 text-lg">Move, cook, watch and chat together. Your evening starts on the home tab.</p>
      <PrimaryButton
        onClick={() => {
          completeOnboarding()
          navigate('/')
        }}
      >
        Start
      </PrimaryButton>
    </main>
  )
}
