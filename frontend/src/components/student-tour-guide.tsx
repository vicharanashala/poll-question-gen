import { useState, useCallback } from 'react'
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import { useNavigate, useLocation } from '@tanstack/react-router'

interface StudentTourGuideProps {
  className?: string
}

export function StudentTourGuide({ className }: StudentTourGuideProps) {
  const [isTourOpen, setIsTourOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()

  const tourSteps: Step[] = [
    {
      target: '[data-tour="dashboard-nav"]',
      content: 'This is your Dashboard navigation. Click here to return to your main dashboard at any time.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="join-room-nav"]',
      content: 'Use this button to join a poll room using a room code provided by your teacher.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="theme-toggle"]',
      content: 'Toggle between light and dark themes to customize your experience.',
      placement: 'bottom-end',
    },
    {
      target: '[data-tour="join-room-btn"]',
      content: 'Quickly join a poll room by entering the room code your teacher provides.',
      placement: 'left',
    },
    {
      target: '[data-tour="poll-stats"]',
      content: 'View your poll statistics including total polls taken, completed, and missed.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="active-polls"]',
      content: 'See your currently active polls that you can participate in right now.',
      placement: 'top',
    },
    {
      target: '[data-tour="performance-summary"]',
      content: 'Track your overall performance including average scores and participation rates.',
      placement: 'top',
    },
    {
      target: '[data-tour="room-scores"]',
      content: 'View detailed scores and performance for each room you have participated in.',
      placement: 'top',
    },
  ]

  const handleTourCallback = useCallback((data: CallBackProps) => {
    const { status, type, index, action } = data

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setIsTourOpen(false)
      setStepIndex(0)
    } else if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        setStepIndex(index + 1)
      } else if (action === ACTIONS.PREV) {
        setStepIndex(index - 1)
      }
    }
  }, [])

  const startTour = async () => {
    // Navigate to home page if not already there
    if (location.pathname !== '/student/home') {
      await navigate({ to: '/student/home' })
      setTimeout(() => {
        setIsTourOpen(true)
        setStepIndex(0)
      }, 500)
    } else {
      setIsTourOpen(true)
      setStepIndex(0)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={startTour}
        className={`hover:bg-blue-50 dark:hover:bg-blue-900/20 ${className}`}
        title="Start guided tour"
      >
        <Info className="h-5 w-5" />
        <span className="sr-only">Start guided tour</span>
      </Button>

      <Joyride
        steps={tourSteps}
        run={isTourOpen}
        stepIndex={stepIndex}
        callback={handleTourCallback}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        scrollToFirstStep={true}
        disableOverlayClose={true}
        spotlightClicks={true}
        hideCloseButton={true}
        styles={{
          options: {
            primaryColor: '#2563eb',
            backgroundColor: '#ffffff',
            textColor: '#374151',
            overlayColor: 'rgba(0, 0, 0, 0.5)',
            arrowColor: '#ffffff',
            zIndex: 10000,
          },
          tooltip: {
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            fontSize: '14px',
            padding: '20px',
          },
          tooltipContainer: {
            textAlign: 'left' as const,
          },
          tooltipContent: {
            fontSize: '14px',
            lineHeight: '1.6',
            padding: '8px 0',
          },
          buttonNext: {
            backgroundColor: '#2563eb',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            padding: '10px 16px',
            border: 'none',
            outline: 'none',
          },
          buttonBack: {
            color: '#6b7280',
            fontSize: '14px',
            fontWeight: '500',
            marginRight: '10px',
            backgroundColor: 'transparent',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            padding: '10px 16px',
          },
          buttonSkip: {
            color: '#6b7280',
            fontSize: '14px',
            fontWeight: '500',
            backgroundColor: 'transparent',
            border: 'none',
          },
          beacon: {
            backgroundColor: '#2563eb',
          },
          spotlight: {
            borderRadius: '8px',
          },
        }}
        locale={{
          back: '← Back',
          close: 'Close',
          last: 'Finish Tour',
          next: 'Next →',
          skip: 'Skip Tour',
        }}
      />
    </>
  )
}

export default StudentTourGuide