import { useState, useCallback } from 'react'
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import { useNavigate, useLocation } from '@tanstack/react-router'

interface TourGuideProps {
  className?: string
}

export function TourGuide({ className }: TourGuideProps) {
  const [isTourOpen, setIsTourOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()

  const tourSteps: Step[] = [
    {
      target: '[data-tour="sidebar-trigger"]',
      content: 'Click this hamburger menu (☰) to open or close the navigation sidebar.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="theme-toggle"]',
      content: 'Toggle between light and dark themes to customize your experience.',
      placement: 'bottom-end',
    },
    {
      target: '[data-tour="create-room-btn"]',
      content: 'Quickly create a new poll room for your students from here.',
      placement: 'left',
    },
    {
      target: '[data-tour="stats-cards"]',
      content: 'View your teaching statistics including total rooms, polls, responses, and participation rates.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="rooms-section"]',
      content: 'Manage and view your active and recent poll rooms. You can see room codes, statistics, and access active rooms.',
      placement: 'top',
    },
    {
      target: '[data-tour="analytics"]',
      content: 'View detailed analytics about your poll responses and room activity with charts and graphs.',
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
    if (location.pathname !== '/teacher/home') {
      await navigate({ to: '/teacher/home' })
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

export default TourGuide